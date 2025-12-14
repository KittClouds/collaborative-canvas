import { useCallback, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { RichTextProvider } from 'reactjs-tiptap-editor';

// Base tiptap extensions
import { Document } from '@tiptap/extension-document';
import { Text } from '@tiptap/extension-text';
import { Paragraph } from '@tiptap/extension-paragraph';
import { HardBreak } from '@tiptap/extension-hard-break';
import { Dropcursor, Gapcursor, Placeholder } from '@tiptap/extensions';
import { TextStyle } from '@tiptap/extension-text-style';
import { ListItem } from '@tiptap/extension-list-item';

// Import extensions from reactjs-tiptap-editor
import { Attachment } from 'reactjs-tiptap-editor/attachment';
import { Blockquote } from 'reactjs-tiptap-editor/blockquote';
import { Bold } from 'reactjs-tiptap-editor/bold';
import { BulletList } from 'reactjs-tiptap-editor/bulletlist';
import { Clear } from 'reactjs-tiptap-editor/clear';
import { Code } from 'reactjs-tiptap-editor/code';
import { CodeBlock } from 'reactjs-tiptap-editor/codeblock';
import { Color } from 'reactjs-tiptap-editor/color';
import { Emoji } from 'reactjs-tiptap-editor/emoji';
import { ExportPdf } from 'reactjs-tiptap-editor/exportpdf';
import { ExportWord } from 'reactjs-tiptap-editor/exportword';
import { FontFamily } from 'reactjs-tiptap-editor/fontfamily';
import { FontSize } from 'reactjs-tiptap-editor/fontsize';
import { Heading } from 'reactjs-tiptap-editor/heading';
import { Highlight } from 'reactjs-tiptap-editor/highlight';
import { History } from 'reactjs-tiptap-editor/history';
import { HorizontalRule } from 'reactjs-tiptap-editor/horizontalrule';
import { Iframe } from 'reactjs-tiptap-editor/iframe';
import { Image } from 'reactjs-tiptap-editor/image';
import { ImageGif } from 'reactjs-tiptap-editor/imagegif';
import { ImportWord } from 'reactjs-tiptap-editor/importword';
import { Indent } from 'reactjs-tiptap-editor/indent';
import { Italic } from 'reactjs-tiptap-editor/italic';
import { LineHeight } from 'reactjs-tiptap-editor/lineheight';
import { Link } from 'reactjs-tiptap-editor/link';
import { Mention } from 'reactjs-tiptap-editor/mention';
import { MoreMark } from 'reactjs-tiptap-editor/moremark';
import { OrderedList } from 'reactjs-tiptap-editor/orderedlist';
import { SearchAndReplace } from 'reactjs-tiptap-editor/searchandreplace';
import { Strike } from 'reactjs-tiptap-editor/strike';
import { Table } from 'reactjs-tiptap-editor/table';
import { TaskList } from 'reactjs-tiptap-editor/tasklist';
import { TextAlign } from 'reactjs-tiptap-editor/textalign';
import { TextUnderline } from 'reactjs-tiptap-editor/textunderline';
import { Video } from 'reactjs-tiptap-editor/video';
import { TextDirection } from 'reactjs-tiptap-editor/textdirection';
import { Katex } from 'reactjs-tiptap-editor/katex';
import { Drawer } from 'reactjs-tiptap-editor/drawer';
import { Excalidraw } from 'reactjs-tiptap-editor/excalidraw';
import { Twitter } from 'reactjs-tiptap-editor/twitter';
import { Mermaid } from 'reactjs-tiptap-editor/mermaid';
import { Column } from 'reactjs-tiptap-editor/column';
import { SlashCommand } from 'reactjs-tiptap-editor/slashcommand';

// Import CSS
import 'reactjs-tiptap-editor/style.css';
import 'prism-code-editor-lightweight/layout.css';
import 'prism-code-editor-lightweight/themes/github-dark.css';
import 'katex/dist/katex.min.css';
import 'easydrawer/styles.css';
import 'react-image-crop/dist/ReactCrop.css';

import { useLayoutDimensions } from '@/hooks/useLayoutDimensions';

interface RichEditorProps {
  content: string;
  onChange: (content: string) => void;
  isDarkMode?: boolean;
  noteId?: string;
  toolbarVisible?: boolean;
  onToolbarVisibilityChange?: (visible: boolean) => void;
}

function convertBase64ToBlob(base64: string) {
  const arr = base64.split(',');
  const mime = arr[0].match(/:(.*?);/)![1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

const extensions = [
  // Base Extensions
  Document,
  Text,
  Paragraph,
  HardBreak,
  Dropcursor,
  Gapcursor,
  TextStyle,
  ListItem,
  Placeholder.configure({
    placeholder: "Start writing or press '/' for commands...",
    showOnlyCurrent: true,
  }),

  // Editor Extensions
  History,
  SearchAndReplace,
  Clear,
  FontFamily,
  Heading.configure({ spacer: true }),
  FontSize,
  Bold,
  Italic,
  TextUnderline,
  Strike,
  MoreMark,
  Highlight,
  Emoji,
  Color.configure({ spacer: true }),
  BulletList,
  OrderedList,
  TextAlign.configure({ types: ['heading', 'paragraph'], spacer: true }),
  Indent,
  LineHeight,
  TaskList.configure({
    spacer: true,
    taskItem: {
      nested: true,
    },
  }),
  Link,
  Image.configure({
    upload: (files: File) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(URL.createObjectURL(files));
        }, 500);
      });
    },
  }),
  Video.configure({
    upload: (files: File) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(URL.createObjectURL(files));
        }, 500);
      });
    },
  }),
  ImageGif.configure({
    API_KEY: import.meta.env.VITE_GIPHY_API_KEY || '',
    provider: 'giphy',
  }),
  Blockquote,
  HorizontalRule,
  Code.configure({
    toolbar: false,
  }),
  CodeBlock,
  Column,
  Table,
  Iframe,
  ExportPdf.configure({ spacer: true }),
  ImportWord.configure({
    upload: (files: File[]) => {
      const f = files.map(file => ({
        src: URL.createObjectURL(file),
        alt: file.name,
      }));
      return Promise.resolve(f);
    },
  }),
  ExportWord,
  TextDirection,
  Mention,
  Attachment.configure({
    upload: (file: any) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);

      return new Promise((resolve) => {
        setTimeout(() => {
          const blob = convertBase64ToBlob(reader.result as string);
          resolve(URL.createObjectURL(blob));
        }, 300);
      });
    },
  }),
  Katex,
  Excalidraw,
  Mermaid.configure({
    upload: (file: any) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);

      return new Promise((resolve) => {
        setTimeout(() => {
          const blob = convertBase64ToBlob(reader.result as string);
          resolve(URL.createObjectURL(blob));
        }, 300);
      });
    },
  }),
  Drawer.configure({
    upload: (file: any) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);

      return new Promise((resolve) => {
        setTimeout(() => {
          const blob = convertBase64ToBlob(reader.result as string);
          resolve(URL.createObjectURL(blob));
        }, 300);
      });
    },
  }),
  Twitter,
  SlashCommand,
];

const RichEditor = ({
  content,
  onChange,
  isDarkMode = false,
  noteId,
  toolbarVisible = true,
  onToolbarVisibilityChange,
}: RichEditorProps) => {
  const previousContentRef = useRef<string>('');

  const dimensions = useLayoutDimensions({
    includeToolbar: toolbarVisible,
  });

  // Parse content to JSON if needed
  const parseContent = useCallback((contentStr: string) => {
    try {
      return typeof contentStr === 'string' ? JSON.parse(contentStr) : contentStr;
    } catch {
      return {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: contentStr || '' }] }],
      };
    }
  }, []);

  const editor = useEditor({
    extensions,
    content: parseContent(content),
    onUpdate: ({ editor }) => {
      const json = editor.getJSON();
      const jsonString = JSON.stringify(json);
      
      if (jsonString !== previousContentRef.current) {
        previousContentRef.current = jsonString;
        onChange(jsonString);
      }
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none min-h-[400px] p-6',
      },
    },
  });

  // Handle keyboard shortcut for toolbar toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault();
        if (onToolbarVisibilityChange) {
          onToolbarVisibilityChange(!toolbarVisible);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toolbarVisible, onToolbarVisibilityChange]);

  // Handle content updates when switching notes
  useEffect(() => {
    if (!editor) return;

    const newContent = typeof content === 'string' ? content : JSON.stringify(content);

    if (newContent !== previousContentRef.current) {
      const parsedContent = parseContent(content);
      editor.commands.setContent(parsedContent, { emitUpdate: false });
      previousContentRef.current = newContent;
    }
  }, [content, editor, parseContent]);

  // Update editor key when noteId changes to force remount
  useEffect(() => {
    if (editor && noteId) {
      const parsedContent = parseContent(content);
      editor.commands.setContent(parsedContent, { emitUpdate: false });
      previousContentRef.current = content;
    }
  }, [noteId, editor, content, parseContent]);

  if (!editor) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground">Loading editor...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <RichTextProvider editor={editor} dark={isDarkMode}>
        <div 
          className="flex-1 overflow-auto custom-scrollbar bg-background"
          style={{ maxHeight: dimensions.availableHeight }}
        >
          <EditorContent editor={editor} className="min-h-full" />
        </div>
      </RichTextProvider>
    </div>
  );
};

export default RichEditor;
