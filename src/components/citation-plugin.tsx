import { createPlatePlugin } from 'platejs/react';
import { PlateElement, PlateElementProps } from 'platejs/react';
import { TElement } from 'platejs';

export interface TCitationElement extends TElement {
  type: 'citation';
  citationNumber: number;
  citationId: string;
}

export const ELEMENT_CITATION = 'citation';

export const CitationPlugin = createPlatePlugin({
  key: ELEMENT_CITATION,
  node: {
    isElement: true,
    isInline: true,
    isVoid: true,
  },
});

export function CitationElement({
  attributes,
  children,
  element,
}: PlateElementProps<TCitationElement>) {
  return (
    <sup
      {...attributes}
      className="citation cursor-pointer text-blue-600 rounded px-1 py-0.5 font-medium select-none underline decoration-blue-300"
      data-citation-number={element.citationNumber}
      data-citation-id={element.citationId}
      contentEditable={false}
      suppressContentEditableWarning
    >
      [{element.citationNumber}]
      {children}
    </sup>
  );
}
