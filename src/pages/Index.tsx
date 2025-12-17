import { AppSidebar } from '@/components/app-sidebar';
import { FooterLinksPanel } from '@/components/FooterLinksPanel';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Menu, FileText, Trash2 } from 'lucide-react';
import RichEditor from '@/components/RichEditor';
import { useTheme } from '@/hooks/useTheme';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useNotes, NotesProvider } from '@/contexts/NotesContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SchemaProvider } from '@/contexts/SchemaContext';
import { SchemaManager } from '@/components/schema/SchemaManager';
import { useLinkIndex } from '@/hooks/useLinkIndex';
import { EntitySelectionProvider } from '@/contexts/EntitySelectionContext';
import { RightSidebar, RightSidebarProvider, RightSidebarTrigger } from '@/components/RightSidebar';
import { TemporalHighlightProvider, useTemporalHighlight } from '@/contexts/TemporalHighlightContext';
import { SearchProvider } from '@/contexts/SearchContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

function NotesApp() {
  const { theme } = useTheme();
  const [toolbarVisible, setToolbarVisible] = useState(() => {
    const saved = localStorage.getItem('editor-toolbar-visible');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const { selectedNote, updateNoteContent, deleteNote, createNote, selectNote, state } = useNotes();
  const { activateTimelineWithTemporal } = useTemporalHighlight();

  // Link index for wikilink navigation and footer links panel
  const { findNoteByTitle, noteExists, getBacklinks, getOutgoingLinks } = useLinkIndex(state.notes);

  const backlinks = useMemo(() =>
    selectedNote ? getBacklinks(selectedNote) : [],
    [selectedNote, getBacklinks]
  );

  const outgoingLinks = useMemo(() =>
    selectedNote ? getOutgoingLinks(selectedNote.id) : [],
    [selectedNote, getOutgoingLinks]
  );

  // Navigate to a note by title (for footer links panel)
  const handleNavigateToNote = useCallback((title: string, createIfNotExists?: boolean) => {
    const existingNote = findNoteByTitleRef.current(title);
    if (existingNote) {
      selectNoteRef.current(existingNote.id);
    } else if (createIfNotExists) {
      const newNote = createNoteRef.current(undefined, title);
      selectNoteRef.current(newNote.id);
    }
  }, []);

  // Use refs to hold latest versions without changing callback references
  const findNoteByTitleRef = useRef(findNoteByTitle);
  const selectNoteRef = useRef(selectNote);
  const createNoteRef = useRef(createNote);
  const noteExistsRef = useRef(noteExists);
  const activateTimelineRef = useRef(activateTimelineWithTemporal);

  // Keep refs updated
  useEffect(() => {
    findNoteByTitleRef.current = findNoteByTitle;
    selectNoteRef.current = selectNote;
    createNoteRef.current = createNote;
    noteExistsRef.current = noteExists;
    activateTimelineRef.current = activateTimelineWithTemporal;
  });

  const handleToolbarVisibilityChange = useCallback((visible: boolean) => {
    setToolbarVisible(visible);
    localStorage.setItem('editor-toolbar-visible', JSON.stringify(visible));
  }, []);

  const handleEditorChange = (content: string) => {
    if (selectedNote) {
      updateNoteContent(selectedNote.id, content);
    }
  };

  const handleDeleteNote = () => {
    if (selectedNote) {
      deleteNote(selectedNote.id);
    }
  };

  // STABLE callbacks using refs - no dependencies means reference never changes
  const handleWikilinkClick = useCallback((title: string) => {
    const existingNote = findNoteByTitleRef.current(title);
    if (existingNote) {
      selectNoteRef.current(existingNote.id);
    } else {
      const newNote = createNoteRef.current(undefined, title);
      selectNoteRef.current(newNote.id);
    }
  }, []);

  const checkWikilinkExists = useCallback((title: string): boolean => {
    return noteExistsRef.current(title);
  }, []);

  const handleTemporalClick = useCallback((temporal: string) => {
    activateTimelineRef.current(temporal);
  }, []);

  return (
    <RightSidebarProvider>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          {/* Left Sidebar */}
          <AppSidebar />

          {/* Main Content Area */}
          <div className="flex flex-col flex-1 min-w-0">
            {/* Header */}
            <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <Breadcrumb className="flex-1">
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink
                      href="#"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Notes
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="text-foreground font-medium">
                      {selectedNote ? selectedNote.title : 'Select a note'}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>

              {/* Header Actions */}
              <div className="flex items-center gap-1">
                <SchemaManager />
                {selectedNote && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        title="Delete note"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete note?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete "{selectedNote.title}". This action cannot be
                          undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteNote}
                          className="bg-destructive hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleToolbarVisibilityChange(!toolbarVisible)}
                  title={toolbarVisible ? 'Hide toolbar (Ctrl+\\)' : 'Show toolbar (Ctrl+\\)'}
                  className="h-8 w-8"
                >
                  <Menu className="h-4 w-4" />
                </Button>
                <RightSidebarTrigger />
                <ThemeToggle />
              </div>
            </header>

            {/* Editor Area */}
            <main className="flex-1 min-h-0 overflow-hidden pb-16">
              {selectedNote ? (
                <RichEditor
                  content={selectedNote.content}
                  onChange={handleEditorChange}
                  isDarkMode={theme === 'dark'}
                  toolbarVisible={toolbarVisible}
                  onToolbarVisibilityChange={handleToolbarVisibilityChange}
                  noteId={selectedNote.id}
                  onWikilinkClick={handleWikilinkClick}
                  checkWikilinkExists={checkWikilinkExists}
                  onTemporalClick={handleTemporalClick}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full bg-background">
                  <div className="text-center space-y-6 max-w-md mx-auto px-6 animate-fade-in">
                    <div className="w-20 h-20 rounded-2xl bg-accent flex items-center justify-center mx-auto">
                      <FileText className="h-10 w-10 text-accent-foreground" />
                    </div>
                    <div className="space-y-3">
                      <h2 className="text-2xl font-semibold text-foreground">No note selected</h2>
                      <p className="text-muted-foreground leading-relaxed">
                        Select a note from the sidebar or create a new one to start writing
                      </p>
                    </div>
                    <Button onClick={() => createNote()} className="gap-2">
                      <FileText className="h-4 w-4" />
                      Create new note
                    </Button>
                  </div>
                </div>
              )}
            </main>
          </div>

          {/* Right Sidebar */}
          <RightSidebar />
        </div>

        {/* Footer Links Panel */}
        <FooterLinksPanel
          backlinks={selectedNote ? backlinks : []}
          outgoingLinks={selectedNote ? outgoingLinks : []}
          notes={state.notes}
          onNavigate={handleNavigateToNote}
        />
      </SidebarProvider>
    </RightSidebarProvider>
  );
}

const Index = () => {
  return (
    <ErrorBoundary>
      <SchemaProvider>
        <NotesProvider>
          <SearchProvider>
            <EntitySelectionProvider>
              <TemporalHighlightProvider>
                <NotesApp />
              </TemporalHighlightProvider>
            </EntitySelectionProvider>
          </SearchProvider>
        </NotesProvider>
      </SchemaProvider>
    </ErrorBoundary>
  );
};

export default Index;
