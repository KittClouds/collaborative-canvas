import { forwardRef } from 'react';
import {
  RichTextBubbleText,
  RichTextBubbleMenuDragHandle,
  RichTextBubbleTable,
  RichTextBubbleImage,
  RichTextBubbleVideo,
  RichTextBubbleLink,
  RichTextBubbleColumns,
  RichTextBubbleIframe,
  RichTextBubbleKatex,
  RichTextBubbleExcalidraw,
  RichTextBubbleMermaid,
  RichTextBubbleDrawer,
  RichTextBubbleTwitter,
} from 'reactjs-tiptap-editor/bubble';

const EditorBubbleMenus = forwardRef<HTMLDivElement>((_, ref) => {
  return (
    <div ref={ref}>
      <RichTextBubbleMenuDragHandle />
      <RichTextBubbleText />
      <RichTextBubbleLink />
      <RichTextBubbleTable />
      <RichTextBubbleImage />
      <RichTextBubbleVideo />
      <RichTextBubbleColumns />
      <RichTextBubbleIframe />
      <RichTextBubbleKatex />
      <RichTextBubbleExcalidraw />
      <RichTextBubbleMermaid />
      <RichTextBubbleDrawer />
      <RichTextBubbleTwitter />
    </div>
  );
});

EditorBubbleMenus.displayName = 'EditorBubbleMenus';

export default EditorBubbleMenus;
