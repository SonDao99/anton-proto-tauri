import { useCallback, useRef, useState, useEffect } from 'react';
import { AIChatPlugin, streamInsertChunk } from '@platejs/ai/react';
import { getPluginType, KEYS } from 'platejs';
import { usePlateEditor } from 'platejs/react';
import { MarkdownJoiner } from '../lib/markdown-joiner-transform';
import { deserializeMd } from '@platejs/markdown';

/**
 * WebSocket hook that waits for sidecar readiness by polling /health
 * before initiating the WebSocket connection. This avoids the "closed
 * before the connection is established" error during app startup.
 */
export function useWsNoteStream(
  sidecarPort: number,
  threadId: string,
  autoPayload?: { message: string; note_type: string }
) {
  const editor = usePlateEditor();
  const editorRef = useRef(editor);
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);
 
  const wsRef = useRef<WebSocket | null>(null);
  const [streaming, setStreaming] = useState(false);

  // Markdown joiner used to sanitize streamed deltas before deserialization.
  const joinerRef = useRef<MarkdownJoiner | null>(null);
  // Buffer for handling newline-delimited or chunked websocket payloads.
  // Many servers emit NDJSON (one JSON object per line) or may split JSON across frames.
  // Keep any incomplete tail here between onmessage calls.
  const wsMessageBufferRef = useRef<string>('');
  const fullContentRef = useRef<string>('');
  const firstInsertRef = useRef<boolean>(true);

  const waitForSidecar = async (timeoutMs = 10000, intervalMs = 300) => {
    const start = Date.now();
    const url = `http://127.0.0.1:${sidecarPort}/health`;
    while (Date.now() - start < timeoutMs) {
      try {
        const res = await fetch(url, { method: 'GET' });
        if (res.ok) {
          return true;
        }
      } catch (e) {
        // ignore network errors while polling
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    return false;
  };

  // keep a ref to autoPayload so `connect` can stay stable and won't change
  // identity when the caller passes an inline object (avoids effect re-runs).
  const autoPayloadRef = useRef(autoPayload);
  useEffect(() => {
    autoPayloadRef.current = autoPayload;
  }, [autoPayload]);

  const connect = useCallback(async () => {
    // Prevent duplicate connections if one is already active or connecting
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    // Ensure the sidecar is up before opening WebSocket to avoid race condition.
    const ready = await waitForSidecar();
    if (!ready) {
      console.warn('Sidecar health check failed; attempting WebSocket anyway.');
    }

    // If a socket is in CLOSING state, let it finish (avoid thrashing)
    if (wsRef.current && wsRef.current.readyState === WebSocket.CLOSING) {
      return;
    }

    if (wsRef.current) wsRef.current.close();
    // initialize sanitizer for this connection
    joinerRef.current = new MarkdownJoiner();
    const ws = new WebSocket(`ws://127.0.0.1:${sidecarPort}/ws/medical-note/${threadId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.debug('WS onopen:', { url: `ws://127.0.0.1:${sidecarPort}/ws/medical-note/${threadId}` });
      setStreaming(true);
      editorRef.current?.setOption(AIChatPlugin, 'streaming', true);
      fullContentRef.current = '';
      firstInsertRef.current = true;
      const payload = autoPayloadRef.current;
      if (payload) {
        try {
          ws.send(JSON.stringify(payload)); // auto-run on connect
          console.debug('WS sent autoPayload');
        } catch (e) {
          console.error('Failed to send autoPayload on connect', e);
        }
      }
    };

    ws.onmessage = (evt) => {
      // Treat each WebSocket text frame as one complete JSON message.
      try {
        const text =
          typeof evt.data === 'string'
            ? evt.data
            : evt.data instanceof ArrayBuffer
            ? new TextDecoder().decode(evt.data)
            : String(evt.data);

        const data = JSON.parse(text);

        // LOG EVERY CHUNK
        if (data.type === 'chunk') {
          console.log('=== CHUNK ===');
          console.log('Length:', data.content?.length);
          console.log('Content (escaped):', JSON.stringify(data.content));
          console.log('Content (raw):', data.content);
        }

        handleWsFrame(data);
      } catch (e) {
        console.error('WS onmessage parsing error', e);
      }
    };

    // Local helper to handle a parsed websocket frame (keeps previous logic unchanged).
    function handleWsFrame(data: any) {
      console.debug('WS onmessage:', data?.type);
      if (data.type === 'chunk') {
        const chunk = data.content;

        if (!chunk || chunk.trim().length === 0) return;

        // ACCUMULATE instead of immediate insert
        fullContentRef.current += chunk;
      } else if (data.type === 'done') {
        // Insert ALL content at once
        if (fullContentRef.current && editorRef.current) {
          console.log('=== FULL CONTENT ===');
          console.log(fullContentRef.current);

          try {
            // Deserialize manually and inspect the nodes
            const nodes = deserializeMd(editorRef.current, fullContentRef.current);
            console.log('=== DESERIALIZED NODES ===');
            console.log(JSON.stringify(nodes, null, 2));

            // Insert the nodes directly
            editorRef.current.tf.insertNodes(nodes);

          } catch (err) {
            console.error('Deserialization error:', err);
          } finally {
            fullContentRef.current = '';
          }
        }

        setStreaming(false);
        editorRef.current?.setOption(AIChatPlugin, 'streaming', false);
      } else if (data.type === 'error') {
        // Server-side error (e.g., missing files). Stop streaming and surface the error in console.
        setStreaming(false);
        editorRef.current?.setOption(AIChatPlugin, 'streaming', false);
        console.error('WS server error:', data?.content ?? data);
      }
    }

    ws.onerror = () => {
      console.error('WS onerror');
      setStreaming(false);
      editorRef.current?.setOption(AIChatPlugin, 'streaming', false);
    };

    ws.onclose = (evt) => {
      console.debug('WS onclose:', { code: evt.code, reason: evt.reason });
      // clear sanitizer for this connection
      joinerRef.current = null;
      setStreaming(false);
      editorRef.current?.setOption(AIChatPlugin, 'streaming', false);
    };
  }, [sidecarPort, threadId]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
  }, []);

  return { connect, disconnect, streaming };
}
