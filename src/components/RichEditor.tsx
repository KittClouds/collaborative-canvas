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
import { Blockquote } from 'reactjs-tiptap-editor/blockquote';
import { Bold } from 'reactjs-tiptap-editor/bold';
import { BulletList } from 'reactjs-tiptap-editor/bulletlist';
import { Code } from 'reactjs-tiptap-editor/code';
import { CodeBlock } from 'reactjs-tiptap-editor/codeblock';
import { Heading } from 'reactjs-tiptap-editor/heading';
import { History } from 'reactjs-tiptap-editor/history';
import { HorizontalRule } from 'reactjs-tiptap-editor/horizontalrule';
import { Italic } from 'reactjs-tiptap-editor/italic';
import { Link } from 'reactjs-tiptap-editor/link';
import { OrderedList } from 'reactjs-tiptap-editor/orderedlist';
import { Strike } from 'reactjs-tiptap-editor/strike';
import { TaskList } from 'reactjs-tiptap-editor/tasklist';
import { TextUnderline } from 'reactjs-tiptap-editor/textunderline';

// Import CSS
import 'reactjs-tiptap-editor/style.css';

import { useLayoutDimensions } from '@/hooks/useLayoutDimensions';

interface RichEditorProps {
  content: string;
  onChange: (content: string) => void;
  isDarkMode?: boolean;
  noteId?: string;
  toolbarVisible?: boolean;
  onToolbarVisibilityChange?: (visible: boolean) => void;
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
  Heading.configure({ spacer: true }),
  Bold,
  Italic,
  TextUnderline,
  Strike,
  Code.configure({ toolbar: false }),
  CodeBlock,
  BulletList,
  OrderedList,
  TaskList.configure({
    spacer: true,
    taskItem: {
      nested: true,
    },
  }),
  Link,
  Blockquote,
  HorizontalRule,
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
          className="flex-1 overflow-auto custom-scrollbar bg-editor-bg"
          style={{ maxHeight: dimensions.availableHeight }}
        >
          <EditorContent editor={editor} className="min-h-full" />
        </div>
      </RichTextProvider>
    </div>
  );
};

export default RichEditor;
