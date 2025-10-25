// components/start-stream-btn.tsx

import { useState } from 'react';

export function StartStreamButton({
  sidecarPort = 8000,
  threadId,
  editor,
}: {
  sidecarPort?: number;
  threadId: string;
  editor: any;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const triggerStream = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`http://127.0.0.1:${sidecarPort}/api/notes/trigger-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId,
          docType: 'ward_round',
          noteOptions: { instruction: 'Generate ward round note' },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      console.log('✓ Stream triggered successfully');
    } catch (e: any) {
      console.error('❌ Failed to trigger stream:', e);
      setError(e.message || 'Failed to trigger stream');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={triggerStream}
        disabled={loading}
        className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-50"
      >
        {loading ? 'Starting...' : 'Generate Note'}
      </button>
      {error && (
        <span className="text-xs text-red-500">
          {error}
        </span>
      )}
    </div>
  );
}

// import { useRef, useState } from 'react';
// import { AIChatPlugin, streamInsertChunk } from '@platejs/ai/react';
// import { withAIBatch } from '@platejs/ai';
// import { getPluginType, KEYS } from 'platejs';
// import { MarkdownJoiner } from '../lib/markdown-joiner-transform';
// import { deserializeMd } from '@platejs/markdown';
// import { nanoid } from 'platejs';

// export function StartStreamButton({
//   sidecarPort = 8000,
//   threadId,
//   editor,
// }: {
//   sidecarPort?: number;
//   threadId: string;
//   editor: any;
// }) {
//   const wsRef = useRef<WebSocket | null>(null);
//   const [status, setStatus] = useState<'idle'|'connecting'|'open'|'streaming'|'error'>('idle');
//   const [error, setError] = useState<string | null>(null);
  
//   const joinerRef = useRef<MarkdownJoiner | null>(null);
//   const fullContentRef = useRef<string>('');
//   const firstInsertRef = useRef<boolean>(true);

//   const start = async () => {
//     setError(null);

//     // Reuse existing OPEN socket if present
//     if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
//       firstInsertRef.current = true;
//       await fetch(`http://127.0.0.1:${sidecarPort}/api/notes/trigger-stream`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           threadId,
//           docType: 'ward_round',
//           noteOptions: { instruction: 'Generate ward round note' },
//         }),
//       });
//       setStatus('streaming');
//       editor?.setOption(AIChatPlugin, 'streaming', true);
//       return;
//     }

//     // If CONNECTING, do nothing (avoid duplicates)
//     if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) {
//       return;
//     }

//     // Open a new WebSocket
//     setStatus('connecting');
//     // joinerRef.current = new MarkdownJoiner();  // DISABLED: MarkdownJoiner strips content
//     const ws = new WebSocket(`ws://127.0.0.1:${sidecarPort}/ws/medical-note/${threadId}`);
//     wsRef.current = ws;

//     ws.onopen = async () => {
//       setStatus('open');
//       fullContentRef.current = '';
//       firstInsertRef.current = true;

//       // Trigger streaming
//       try {
//         await fetch(`http://127.0.0.1:${sidecarPort}/api/notes/trigger-stream`, {
//           method: 'POST',
//           headers: { 'Content-Type': 'application/json' },
//           body: JSON.stringify({
//             threadId,
//             docType: 'ward_round',
//             noteOptions: { instruction: 'Generate ward round note' },
//           }),
//         });
//         setStatus('streaming');
//         editor?.setOption(AIChatPlugin, 'streaming', true);
//       } catch (e) {
//         console.error('[StartStreamButton] Failed to trigger stream:', e);
//         setError('Failed to trigger stream');
//         setStatus('error');
//         editor?.setOption(AIChatPlugin, 'streaming', false);
//       }
//     };

//     ws.onmessage = (ev) => {
//       try {
//         const text = typeof ev.data === 'string'
//           ? ev.data
//           : ev.data instanceof ArrayBuffer
//           ? new TextDecoder().decode(ev.data)
//           : String(ev.data);

//         const data = JSON.parse(text);

//         // LOG EVERY CHUNK
//         if (data.type === 'chunk') {
//           console.log('=== CHUNK ===');
//           console.log('Length:', data.content?.length);
//           console.log('Content (escaped):', JSON.stringify(data.content));
//           console.log('Content (raw):', data.content);
//         }

//         handleWsFrame(data);
//       } catch (e) {
//         console.error('[StartStreamButton] WebSocket parsing error:', e);
//       }
//     };

//     // function handleWsFrame(data: any) {
//     //   if (data.type === 'chunk') {
//     //     const raw = data.content;
        
//     //     // Sanitize with MarkdownJoiner (optional - disable if causing issues)
//     //     // const sanitized = joinerRef.current && typeof raw === 'string'
//     //     //   ? joinerRef.current.processText(raw)
//     //     //   : raw;
//     //     const sanitized = raw;

//     //     if (!sanitized || (typeof sanitized === 'string' && sanitized.trim().length === 0)) {
//     //       return;
//     //     }

//     //     if (typeof sanitized === 'string') {
//     //       try {
//     //         if (editor) {
//     //           // Call streamInsertChunk directly - NO withAIBatch wrapper
//     //           editor.tf.withScrolling(() => {
//     //             streamInsertChunk(editor, sanitized, {
//     //               textProps: { [getPluginType(editor, KEYS.ai)]: true },
//     //             });
//     //           });
//     //           firstInsertRef.current = false;
//     //         } else {
//     //           // Buffer if editor temporarily unavailable
//     //           fullContentRef.current += sanitized;
//     //         }
//     //       } catch (err) {
//     //         console.error('[StartStreamButton] streamInsertChunk failed:', err);
//     //       }
//     //     }
//     //   } else if (data.type === 'done') {
//     //     // Flush buffered content if editor wasn't available during streaming
//     //     if (fullContentRef.current && fullContentRef.current.length > 0) {
//     //       try {
//     //         if (editor) {
//     //           editor.tf.withScrolling(() => {
//     //             streamInsertChunk(editor, fullContentRef.current, {
//     //               textProps: { [getPluginType(editor, KEYS.ai)]: true },
//     //             });
//     //           });
//     //           firstInsertRef.current = false;
//     //         }
//     //       } catch (err) {
//     //         console.error('[StartStreamButton] Failed to insert buffered content:', err);
//     //       } finally {
//     //         fullContentRef.current = '';
//     //       }
//     //     }

//     //     setStatus('open');
//     //     editor?.setOption(AIChatPlugin, 'streaming', false);
//     //   } else if (data.type === 'error') {
//     //     setError(data.content || 'Error');
//     //     setStatus('error');
//     //     editor?.setOption(AIChatPlugin, 'streaming', false);
//     //   }
//     // }
//     function handleWsFrame(data: any) {
//       if (data.type === 'chunk') {
//         const chunk = data.content;

//         if (!chunk || chunk.trim().length === 0) return;

//         // ACCUMULATE instead of immediate insert
//         fullContentRef.current += chunk;
//       } else if (data.type === 'done') {
//         if (fullContentRef.current && editor) {
//           console.log('=== FULL CONTENT TO INSERT ===');
//           console.log(fullContentRef.current);

//           try {
//             editor.tf.withScrolling(() => {
//               streamInsertChunk(editor, fullContentRef.current, {
//                 textProps: { [getPluginType(editor, KEYS.ai)]: true },
//               });
//             });

//             // Fix: Ensure all blocks are proper paragraphs with IDs
//             setTimeout(() => {
//               const aiNodes = editor.api.node.findAll({
//                 match: { type: getPluginType(editor, KEYS.aiChat) }
//               });

//               if (aiNodes && aiNodes.length > 0) {
//                 const [aiNode, aiPath] = aiNodes[0];

//                 // Iterate through all children
//                 (aiNode.children || []).forEach((child: any, index: number) => {
//                   const childPath = [...aiPath, index];

//                   // If it's a text node (not a proper block), wrap it in a paragraph
//                   if (!child.type || child.type === 'text') {
//                     editor.tf.wrapNodes(
//                       { type: 'p', id: nanoid() },
//                       { at: childPath }
//                     );
//                   }
//                   // If it's a block without an ID, add one
//                   else if (!child.id) {
//                     editor.tf.setNodes(
//                       { id: nanoid() },
//                       { at: childPath }
//                     );
//                   }
//                 });
//               }
//             }, 200);

//           } catch (err) {
//             console.error('Insert failed:', err);
//           } finally {
//             fullContentRef.current = '';
//           }
//         }

//         setStatus('open');
//         editor?.setOption(AIChatPlugin, 'streaming', false);
//       } else if (data.type === 'error') {
//         setError(data.content || 'Error');
//         setStatus('error');
//         editor?.setOption(AIChatPlugin, 'streaming', false);
//       }
//     }

//     ws.onerror = () => {
//       setError('WebSocket error');
//       setStatus('error');
//       editor?.setOption(AIChatPlugin, 'streaming', false);
//     };

//     ws.onclose = () => {
//       setStatus('idle');
//       editor?.setOption(AIChatPlugin, 'streaming', false);
//       joinerRef.current = null;
//       firstInsertRef.current = true;
//       wsRef.current = null;
//     };
//   };

//   const stop = () => {
//     try { 
//       wsRef.current?.close(); 
//     } catch {}
//     wsRef.current = null;
//     setStatus('idle');
//     editor?.setOption(AIChatPlugin, 'streaming', false);
//   };

//   return (
//     <div className="flex items-center gap-2">
//       <button
//         onClick={status === 'streaming' || status === 'open' ? stop : start}
//         className="px-3 py-1 rounded bg-blue-600 text-white"
//       >
//         {status === 'streaming' ? 'Stop' : 'Start stream'}
//       </button>
//       <span className="text-xs text-gray-500">
//         {status}{error ? ` • ${error}` : ''}
//       </span>
//     </div>
//   );
// }
