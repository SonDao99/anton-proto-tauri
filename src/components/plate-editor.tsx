'use client';

import { useCallback, useMemo, useState } from 'react';
import { NodeIdPlugin, TElement } from 'platejs';
import { Plate, usePlateEditor } from 'platejs/react';

import { BasicNodesKit } from '@/components/basic-nodes-kit';
import { Editor, EditorContainer } from '@/components/ui/editor';
import { Toolbar, ToolbarGroup } from '@/components/ui/toolbar';
import { MarkToolbarButton } from '@/components/ui/mark-toolbar-button';
import { DndKit } from '@/components/dnd-kit';
import { BlockSelectionKit } from '@/components/block-selection-kit';
import { SuggestionKit } from '@/components/suggestion-kit';
import { CommentKit } from '@/components/comment-kit';
import { FloatingToolbarKit } from '@/components/floating-toolbar-kit';
import { DiscussionKit } from '@/components/discussion-kit';
import { AIKit } from '@/components/ai-kit';
import { useAutoTriggeredStream } from '@/hooks/use-auto-triggered-stream';
import { StartStreamButton } from './start-stream-btn';
import { MarkdownKit } from '@/components/markdown-kit';
import { ListKit } from '@/components/list-kit';
import { CitationPlugin, CitationElement, ELEMENT_CITATION } from '@/components/citation-plugin';
import { CitationModal } from '@/components/CitationModal';
import { Citation } from '@/types/ward-round';
import { deserializeMd } from '@platejs/markdown';

export function PlateEditor() {
  const [citations, setCitations] = useState<Record<string, Citation>>({});
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const editor = usePlateEditor({
    plugins: [
      NodeIdPlugin,
      CitationPlugin,
      ...ListKit,
      ...BlockSelectionKit,
      ...BasicNodesKit,
      ...DndKit,
      ...CommentKit,
      ...SuggestionKit,
      ...FloatingToolbarKit,
      ...DiscussionKit,
      ...MarkdownKit,
      ...AIKit,
    ],
    override: {
      components: {
        [ELEMENT_CITATION]: CitationElement,
      },
    },
  });

  const threadId = useMemo(() => `medical-${Date.now()}`, []);

  console.log('PlateEditor threadId:', threadId); // Debug log

  // Handle WebSocket messages
  const handleMessage = useCallback((message: any) => {
    if (message.type === 'note_complete') {
      const { markdown, citations: newCitations } = message.data;

      console.log('Processing note_complete');
      console.log('Citations received:', Object.keys(newCitations).length);

      // Store citations first
      setCitations(newCitations);

      // // Remove References section
      let processedMarkdown = markdown;
      const refIndex = markdown.indexOf('## References');
      if (refIndex !== -1) {
        processedMarkdown = markdown.substring(0, refIndex).trim();
      }

      // Parse markdown
      const parsed = deserializeMd(editor, processedMarkdown);
      
      // Inject citations
      const withCitations = injectCitations(parsed, newCitations);
      
      // Update editor
      editor.children = withCitations;
      // editor.onChange();

      console.log('Editor updated with', Object.keys(newCitations).length, 'citations');
    }
  }, [editor]);

  const { connected, streaming, error } = useAutoTriggeredStream(8000, {
    threadId,
    docType: 'ward_round',
    noteOptions: { instruction: 'Generate ward round note' },
    onMessage: handleMessage,
  });

  // Handle citation clicks - event delegation
  const handleEditorClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    
    // Check if clicked element or parent is citation
    const citationElement = target.closest('.citation');
    
    if (citationElement) {
      e.preventDefault();
      e.stopPropagation();
      
      const citationNum = citationElement.getAttribute('data-citation-number');
      
      console.log('Citation clicked:', citationNum);
      console.log('Available citations:', Object.keys(citations));
      
      if (citationNum && citations[citationNum]) {
        console.log('Opening modal for citation:', citations[citationNum]);
        setSelectedCitation(citations[citationNum]);
        setIsModalOpen(true);
      } else {
        console.warn('Citation not found:', citationNum);
      }
    }
  }, [citations]);

  return (
    <>
      <Plate editor={editor}>
        <div className="px-3 py-2 text-xs text-muted-foreground flex gap-4">
          <StartStreamButton threadId={threadId} sidecarPort={8000} editor={editor} />
          <div>
            WS: {connected ? '✓ connected' : '✗ disconnected'} •
            Stream: {streaming ? '⚡ active' : '⏸ idle'}
            {Object.keys(citations).length > 0 && ` • ${Object.keys(citations).length} citations`}
            {error && ` • ⚠️ ${error}`}
          </div>
        </div>

        {/* Wrapper div for click handling */}
        <div onClick={handleEditorClick}>
          <EditorContainer>
            <Toolbar className="flex justify-start gap-1 rounded-t-lg">
              <ToolbarGroup>
                <MarkToolbarButton nodeType="bold" tooltip="Bold (Ctrl/Cmd+B)">
                  B
                </MarkToolbarButton>
                <MarkToolbarButton nodeType="italic" tooltip="Italic (Ctrl/Cmd+I)">
                  <i>I</i>
                </MarkToolbarButton>
                <MarkToolbarButton nodeType="underline" tooltip="Underline (Ctrl/Cmd+U)">
                  <u>U</u>
                </MarkToolbarButton>
                <MarkToolbarButton nodeType="code" tooltip="Inline code (Ctrl/Cmd+E)">
                  {'<>'}
                </MarkToolbarButton>
                <MarkToolbarButton nodeType="strikethrough" tooltip="Strikethrough">
                  S
                </MarkToolbarButton>
                <MarkToolbarButton nodeType="highlight" tooltip="Highlight">
                  H
                </MarkToolbarButton>
                <MarkToolbarButton nodeType="kbd" tooltip="Kbd">
                  Kbd
                </MarkToolbarButton>
              </ToolbarGroup>
            </Toolbar>

            <Editor placeholder="Ward round note will appear here..." />
          </EditorContainer>
        </div>
      </Plate>

      <CitationModal
        citation={selectedCitation}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedCitation(null);
        }}
      />
    </>
  );
}

// Helper functions
function injectCitations(nodes: any[], citations: Record<string, Citation>): any[] {
  return nodes.map((node) => {
    if ('children' in node) {
      return {
        ...node,
        children: injectCitationsInChildren(node.children, citations),
      };
    }
    return node;
  });
}

function injectCitationsInChildren(
  children: any[],
  citations: Record<string, Citation>
): any[] {
  const result: any[] = [];

  for (const child of children) {
    if ('text' in child) {
      const text = child.text;
      const parts = text.split(/(\[\d+\])/g);

      for (const part of parts) {
        const match = part.match(/\[(\d+)\]/);
        
        if (match) {
          const citationNumber = parseInt(match[1]);
          const citation = citations[citationNumber.toString()];
          
          if (citation) {
            result.push({
              type: ELEMENT_CITATION,
              citationNumber,
              citationId: citation.id,
              children: [{ text: '' }],
            });
          } else {
            result.push({ text: part });
          }
        } else if (part) {
          const textNode: any = { text: part };
          
          if ('bold' in child) textNode.bold = child.bold;
          if ('italic' in child) textNode.italic = child.italic;
          if ('underline' in child) textNode.underline = child.underline;
          if ('code' in child) textNode.code = child.code;
          if ('strikethrough' in child) textNode.strikethrough = child.strikethrough;
          if ('highlight' in child) textNode.highlight = child.highlight;
          
          result.push(textNode);
        }
      }
    } else if ('children' in child) {
      result.push({
        ...child,
        children: injectCitationsInChildren(child.children, citations),
      });
    } else {
      result.push(child);
    }
  }

  return result;
}