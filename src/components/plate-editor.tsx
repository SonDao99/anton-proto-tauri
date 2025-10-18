'use client';

import { normalizeNodeId } from 'platejs';
import { Plate, usePlateEditor } from 'platejs/react';

import { BasicNodesKit } from '@/components/basic-nodes-kit';
import { Editor, EditorContainer } from '@/components/ui/editor';
import { Toolbar, ToolbarGroup } from '@/components/ui/toolbar';
import { MarkToolbarButton } from '@/components/ui/mark-toolbar-button';
import { DndKit } from '@/components/dnd-kit';
import { BlockSelectionPlugin } from '@platejs/selection/react';


export function PlateEditor() {
  const editor = usePlateEditor({
    plugins: [
      ...BasicNodesKit,
      ...DndKit,
      BlockSelectionPlugin.configure({
        options: {
          isSelectionAreaVisible: true,
        },
      }),
    ],
    value,
  });

  return (
    <Plate editor={editor}>
      <EditorContainer>
        <Toolbar className="flex justify-start gap-1 rounded-t-lg">
          <ToolbarGroup>
            <MarkToolbarButton
              nodeType="bold"
              tooltip="Bold (Ctrl/Cmd+B)"
              aria-label="Bold"
            >
              B
            </MarkToolbarButton>
            <MarkToolbarButton
              nodeType="italic"
              tooltip="Italic (Ctrl/Cmd+I)"
              aria-label="Italic"
            >
              <i>I</i>
            </MarkToolbarButton>
            <MarkToolbarButton
              nodeType="underline"
              tooltip="Underline (Ctrl/Cmd+U)"
              aria-label="Underline"
            >
              <u>U</u>
            </MarkToolbarButton>
            <MarkToolbarButton
              nodeType="code"
              tooltip="Inline code (Ctrl/Cmd+E)"
              aria-label="Code"
            >
              {'<>'}
            </MarkToolbarButton>
            <MarkToolbarButton
              nodeType="strikethrough"
              tooltip="Strikethrough"
              aria-label="Strikethrough"
            >
              S
            </MarkToolbarButton>
            <MarkToolbarButton
              nodeType="highlight"
              tooltip="Highlight"
              aria-label="Highlight"
            >
              H
            </MarkToolbarButton>
            <MarkToolbarButton nodeType="kbd" tooltip="Kbd" aria-label="Kbd">
              Kbd
            </MarkToolbarButton>
          </ToolbarGroup>
        </Toolbar>

        <Editor variant="demo" placeholder="Type..." />
      </EditorContainer>
    </Plate>
  );
}

const value = normalizeNodeId([
  {
    children: [{ text: 'Basic Editor' }],
    type: 'h1',
  },
  {
    children: [{ text: 'Heading 2' }],
    type: 'h2',
  },
  {
    children: [{ text: 'Heading 3' }],
    type: 'h3',
  },
  {
    children: [{ text: 'This is a blockquote element' }],
    type: 'blockquote',
  },
  {
    children: [
      { text: 'Basic marks: ' },
      { bold: true, text: 'bold' },
      { text: ', ' },
      { italic: true, text: 'italic' },
      { text: ', ' },
      { text: 'underline', underline: true },
      { text: ', ' },
      { strikethrough: true, text: 'strikethrough' },
      { text: '.' },
    ],
    type: 'p',
  },
]);
