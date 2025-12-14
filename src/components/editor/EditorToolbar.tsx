import { Separator } from '@/components/ui/separator';

// Import toolbar components from reactjs-tiptap-editor extensions
import { RichTextUndo, RichTextRedo } from 'reactjs-tiptap-editor/history';
import { RichTextBold } from 'reactjs-tiptap-editor/bold';
import { RichTextItalic } from 'reactjs-tiptap-editor/italic';
import { RichTextUnderline } from 'reactjs-tiptap-editor/textunderline';
import { RichTextStrike } from 'reactjs-tiptap-editor/strike';
import { RichTextHeading } from 'reactjs-tiptap-editor/heading';
import { RichTextFontSize } from 'reactjs-tiptap-editor/fontsize';
import { RichTextFontFamily } from 'reactjs-tiptap-editor/fontfamily';
import { RichTextColor } from 'reactjs-tiptap-editor/color';
import { RichTextHighlight } from 'reactjs-tiptap-editor/highlight';
import { RichTextBulletList } from 'reactjs-tiptap-editor/bulletlist';
import { RichTextOrderedList } from 'reactjs-tiptap-editor/orderedlist';
import { RichTextTaskList } from 'reactjs-tiptap-editor/tasklist';
import { RichTextAlign } from 'reactjs-tiptap-editor/textalign';
import { RichTextIndent } from 'reactjs-tiptap-editor/indent';
import { RichTextLineHeight } from 'reactjs-tiptap-editor/lineheight';
import { RichTextLink } from 'reactjs-tiptap-editor/link';
import { RichTextImage } from 'reactjs-tiptap-editor/image';
import { RichTextVideo } from 'reactjs-tiptap-editor/video';
import { RichTextTable } from 'reactjs-tiptap-editor/table';
import { RichTextBlockquote } from 'reactjs-tiptap-editor/blockquote';
import { RichTextHorizontalRule } from 'reactjs-tiptap-editor/horizontalrule';
import { RichTextCode } from 'reactjs-tiptap-editor/code';
import { RichTextCodeBlock } from 'reactjs-tiptap-editor/codeblock';
import { RichTextClear } from 'reactjs-tiptap-editor/clear';
import { RichTextMoreMark } from 'reactjs-tiptap-editor/moremark';
import { RichTextEmoji } from 'reactjs-tiptap-editor/emoji';
import { RichTextColumn } from 'reactjs-tiptap-editor/column';
import { RichTextSearchAndReplace } from 'reactjs-tiptap-editor/searchandreplace';
import { RichTextExportPdf } from 'reactjs-tiptap-editor/exportpdf';
import { RichTextExportWord } from 'reactjs-tiptap-editor/exportword';
import { RichTextImportWord } from 'reactjs-tiptap-editor/importword';
import { RichTextTextDirection } from 'reactjs-tiptap-editor/textdirection';
import { RichTextIframe } from 'reactjs-tiptap-editor/iframe';
import { RichTextKatex } from 'reactjs-tiptap-editor/katex';
import { RichTextExcalidraw } from 'reactjs-tiptap-editor/excalidraw';
import { RichTextMermaid } from 'reactjs-tiptap-editor/mermaid';
import { RichTextDrawer } from 'reactjs-tiptap-editor/drawer';
import { RichTextTwitter } from 'reactjs-tiptap-editor/twitter';

const EditorToolbar = () => {
  return (
    <div className="flex items-center gap-0.5 flex-wrap border-b border-border bg-background p-1.5 rounded-t-md sticky top-0 z-10">
      {/* History */}
      <RichTextUndo />
      <RichTextRedo />
      
      <Separator orientation="vertical" className="mx-1 h-6" />
      
      {/* Text Style */}
      <RichTextFontFamily />
      <RichTextFontSize />
      <RichTextHeading />
      
      <Separator orientation="vertical" className="mx-1 h-6" />
      
      {/* Basic Formatting */}
      <RichTextBold />
      <RichTextItalic />
      <RichTextUnderline />
      <RichTextStrike />
      <RichTextMoreMark />
      
      <Separator orientation="vertical" className="mx-1 h-6" />
      
      {/* Color */}
      <RichTextColor />
      <RichTextHighlight />
      
      <Separator orientation="vertical" className="mx-1 h-6" />
      
      {/* Lists */}
      <RichTextBulletList />
      <RichTextOrderedList />
      <RichTextTaskList />
      
      <Separator orientation="vertical" className="mx-1 h-6" />
      
      {/* Alignment & Spacing */}
      <RichTextAlign />
      <RichTextIndent />
      <RichTextLineHeight />
      <RichTextTextDirection />
      
      <Separator orientation="vertical" className="mx-1 h-6" />
      
      {/* Insert */}
      <RichTextLink />
      <RichTextImage />
      <RichTextVideo />
      <RichTextTable />
      <RichTextColumn />
      <RichTextBlockquote />
      <RichTextHorizontalRule />
      <RichTextEmoji />
      
      <Separator orientation="vertical" className="mx-1 h-6" />
      
      {/* Code */}
      <RichTextCode />
      <RichTextCodeBlock />
      
      <Separator orientation="vertical" className="mx-1 h-6" />
      
      {/* Advanced */}
      <RichTextIframe />
      <RichTextKatex />
      <RichTextExcalidraw />
      <RichTextMermaid />
      <RichTextDrawer />
      <RichTextTwitter />
      
      <Separator orientation="vertical" className="mx-1 h-6" />
      
      {/* Tools */}
      <RichTextSearchAndReplace />
      <RichTextClear />
      
      <Separator orientation="vertical" className="mx-1 h-6" />
      
      {/* Export/Import */}
      <RichTextImportWord />
      <RichTextExportWord />
      <RichTextExportPdf />
    </div>
  );
};

export default EditorToolbar;
