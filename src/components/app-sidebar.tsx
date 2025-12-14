import * as React from 'react';
import { Plus, Search, FileText, Clock, Check } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarRail,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNotes } from '@/contexts/NotesContext';
import { cn } from '@/lib/utils';

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { 
    state, 
    selectedNote, 
    filteredNotes, 
    createNote, 
    selectNote, 
    setSearchQuery 
  } = useNotes();

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <Sidebar className="border-r border-sidebar-border" {...props}>
      <SidebarHeader className="border-b border-sidebar-border p-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-semibold tracking-tight">Notes</h1>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 hover:bg-sidebar-accent"
            onClick={() => createNote()}
            title="New Note"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search notes..."
            className="pl-9 h-9 bg-sidebar-accent border-none"
            value={state.searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </SidebarHeader>

      <SidebarContent className="custom-scrollbar">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground px-3">
            All Notes ({filteredNotes.length})
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredNotes.length === 0 ? (
                <div className="px-3 py-8 text-center text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No notes yet</p>
                  <p className="text-xs mt-1">Create your first note to get started</p>
                </div>
              ) : (
                filteredNotes.map((note) => (
                  <SidebarMenuItem key={note.id}>
                    <button
                      onClick={() => selectNote(note.id)}
                      className={cn(
                        'note-item w-full text-left group',
                        selectedNote?.id === note.id && 'note-item-active'
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <FileText className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {note.title || 'Untitled Note'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(note.updatedAt)}
                          </p>
                        </div>
                      </div>
                    </button>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{state.notes.length} notes</span>
          {state.isSaving ? (
            <span className="flex items-center gap-1 animate-pulse-subtle">
              <div className="h-2 w-2 rounded-full bg-warning" />
              Saving...
            </span>
          ) : state.lastSaved ? (
            <span className="flex items-center gap-1">
              <Check className="h-3 w-3 text-success" />
              Saved
            </span>
          ) : null}
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
