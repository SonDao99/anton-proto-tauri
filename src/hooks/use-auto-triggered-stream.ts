// hooks/use-auto-triggered-stream.ts

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePlateEditor } from 'platejs/react';
import { AIChatPlugin } from '@platejs/ai/react';

type TriggerPayload = {
  threadId: string;
  docType?: string;
  noteOptions?: { instruction?: string };
  onMessage?: (message: any) => void;
};

export function useAutoTriggeredStream(sidecarPort: number, initial: TriggerPayload) {
  const editor = usePlateEditor();
  const mountedRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);



  const payload = useMemo(
    () => ({ docType: 'ward_round', noteOptions: {}, ...initial }),
    [initial]
  );

  useEffect(() => {
    // Use a per-effect ws reference so cleanup only closes the socket created by this effect.
    let ws: WebSocket | null = null;
    mountedRef.current = true;

    // Prevent duplicate connections if one is already active or connecting
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      // existing connection is active — don't create another
      mountedRef.current = false;
      return;
    }

    // Async IIFE so we can await sidecar readiness before opening WS
    (async () => {
      setError(null);

      const healthUrl = `http://127.0.0.1:${sidecarPort}/health`;
      const waitForSidecar = async (timeoutMs = 10000, intervalMs = 300) => {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
          try {
            const res = await fetch(healthUrl, { method: 'GET' });
            if (res.ok) return true;
          } catch (e) {
            // ignore network errors while polling
          }
          await new Promise((r) => setTimeout(r, intervalMs));
        }
        return false;
      };

      const ready = await waitForSidecar();
      if (!ready) {
        console.warn('Sidecar health check failed; attempting WebSocket anyway.');
      }

      // create socket and attach handlers
      try {
        ws = new WebSocket(`ws://127.0.0.1:${sidecarPort}/ws/medical-note/${payload.threadId}`);
        wsRef.current = ws;
      } catch (e: any) {
        console.error('Failed to construct WebSocket:', e);
        setError('Failed to construct WebSocket');
        mountedRef.current = false;
        return;
      }

      ws.onopen = async () => {
        console.log('✓ WebSocket connected');
        setConnected(true);
        setStreaming(true);
        editor?.setOption(AIChatPlugin, 'streaming', true);
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          console.log('📩 WebSocket message:', msg.type);

          // ALWAYS call custom message handler first
          if (initial.onMessage) {
            initial.onMessage(msg);
          }

          // DON'T process chunks - let handleMessage in PlateEditor handle everything
          // The onMessage callback will process note_complete and update the editor
          
          if (msg.type === 'note_complete') {
            console.log('✓ Note complete received');
            setStreaming(false);
            editor?.setOption(AIChatPlugin, 'streaming', false);
          } else if (msg.type === 'done') {
            console.log('✓ Stream done');
            setStreaming(false);
            editor?.setOption(AIChatPlugin, 'streaming', false);
          } else if (msg.type === 'error') {
            console.error('❌ Stream error:', msg.content);
            setError(msg.content || 'Error');
            setStreaming(false);
            editor?.setOption(AIChatPlugin, 'streaming', false);
          }
        } catch (e: any) {
          console.error('❌ Parse error:', e);
          setError(e?.message || 'Parse error');
        }
      };

      ws.onerror = (ev) => {
        console.error('❌ WebSocket error', ev);
        setError('WebSocket error');
        setStreaming(false);
        editor?.setOption(AIChatPlugin, 'streaming', false);
      };

      ws.onclose = (evt) => {
        console.log('🔌 WebSocket closed', { code: (evt as CloseEvent)?.code, reason: (evt as CloseEvent)?.reason });
        setConnected(false);
        setStreaming(false);
        editor?.setOption(AIChatPlugin, 'streaming', false);
        // only clear the shared ref if it still points to this socket
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
      };
    })();

    // Cleanup: only close the socket created by this effect (if any)
    return () => {
      console.log('🧹 Cleaning up WebSocket');
      try {
        if (ws && wsRef.current === ws) {
          ws.close();
        }
      } catch {}
      // ensure we don't leave dangling refs
      if (wsRef.current === ws) {
        wsRef.current = null;
      }
      mountedRef.current = false;
    };
    // Only reopen if threadId or port changes
  }, [editor, sidecarPort, payload.threadId]);

  // CRITICAL: return values for the component to destructure
  return {
    connected,
    streaming,
    error,
    reopen: () => {
      // optional: allow manual reopen if needed
      if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
        // no-op here; remounting or changing threadId can trigger useEffect
      }
    },
    close: () => {
      try { wsRef.current?.close(); } catch {}
      wsRef.current = null;
    },
  };
}
