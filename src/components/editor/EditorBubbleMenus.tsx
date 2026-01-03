// Import bubble menu components
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
import { AIBubbleMenu } from './AIBubbleMenu';

const EditorBubbleMenus = () => {
  return (
    <>
      {/* AI bubble menu for inline editing (uses Portal to avoid DOM conflicts) */}
      <AIBubbleMenu />

      {/* Drag handle for moving blocks */}
      <RichTextBubbleMenuDragHandle />

      {/* Text selection bubble menu */}
      <RichTextBubbleText />
      {/* Link bubble menu */}
      <RichTextBubbleLink />

      {/* Table bubble menu */}
      <RichTextBubbleTable />

      {/* Image bubble menu */}
      <RichTextBubbleImage />

      {/* Video bubble menu */}
      <RichTextBubbleVideo />

      {/* Columns bubble menu */}
      <RichTextBubbleColumns />

      {/* Iframe bubble menu */}
      <RichTextBubbleIframe />

      {/* Katex bubble menu */}
      <RichTextBubbleKatex />

      {/* Excalidraw bubble menu */}
      <RichTextBubbleExcalidraw />

      {/* Mermaid bubble menu */}
      <RichTextBubbleMermaid />

      {/* Drawer bubble menu */}
      <RichTextBubbleDrawer />

      {/* Twitter bubble menu */}
      <RichTextBubbleTwitter />
    </>
  );
};

export default EditorBubbleMenus;
