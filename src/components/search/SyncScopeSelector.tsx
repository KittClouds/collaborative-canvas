import { useState, useMemo } from 'react';
import { Zap, ChevronDown, X, Folder, FileText, Globe, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { useJotaiNotes } from '@/hooks/useJotaiNotes';
import { useJotaiSearch } from '@/hooks/useJotaiSearch';
import type { SyncScope } from '@/lib/embeddings/syncService';

export function SyncScopeSelector() {
  const { selectedNote, state } = useJotaiNotes();
  const { syncEmbeddings, cancelSync, syncStatus, syncProgress } = useJotaiSearch();

  const [isOpen, setIsOpen] = useState(false);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set());
  const [includeQuickNotes, setIncludeQuickNotes] = useState(true);

  const folders = useMemo(() => {
    return state.folders;
  }, [state.folders]);

  const handleSyncCurrentNote = async () => {
    if (!selectedNote) return;
    setIsOpen(false);
    await syncEmbeddings({ type: 'note', noteId: selectedNote.id });
  };

  const handleSyncCurrentFolder = async () => {
    if (!selectedNote?.folderId) return;
    setIsOpen(false);
    await syncEmbeddings({ type: 'folder', folderId: selectedNote.folderId });
  };

  const handleSyncGlobal = async () => {
    setIsOpen(false);
    await syncEmbeddings({ type: 'global' });
  };

  const handleOpenFolderPicker = () => {
    setIsOpen(false);
    setSelectedFolderIds(new Set(folders.map(f => f.id)));
    setShowFolderPicker(true);
  };

  const handleSyncSelectedFolders = async () => {
    const scope: SyncScope = {
      type: 'folders',
      folderIds: Array.from(selectedFolderIds),
      includeQuickNotes,
    };
    setShowFolderPicker(false);
    await syncEmbeddings(scope);
  };

  const toggleFolder = (folderId: string) => {
    const newSet = new Set(selectedFolderIds);
    if (newSet.has(folderId)) {
      newSet.delete(folderId);
    } else {
      newSet.add(folderId);
    }
    setSelectedFolderIds(newSet);
  };

  const progressPercent = syncProgress
    ? Math.round((syncProgress.current / Math.max(syncProgress.total, 1)) * 100)
    : 0;

  if (syncStatus.isRunning) {
    return (
      <div className="space-y-2 p-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {syncProgress?.phase === 'embedding' ? 'Embedding...' :
              syncProgress?.phase === 'saving' ? 'Saving...' :
                syncProgress?.phase === 'preparing' ? 'Preparing...' : 'Syncing...'}
          </span>
          <Button variant="ghost" size="sm" onClick={cancelSync} className="h-6 px-2">
            <X className="h-3 w-3 mr-1" />
            Cancel
          </Button>
        </div>
        <Progress value={progressPercent} className="h-2" />
        {syncProgress?.currentNote && (
          <p className="text-xs text-muted-foreground truncate">
            {syncProgress.currentNote}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {syncProgress?.current || 0} / {syncProgress?.total || 0} notes
        </p>
      </div>
    );
  }

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-between gap-2">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              <span>Sync Embeddings</span>
            </div>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-1" align="start">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 h-9"
            onClick={handleSyncCurrentNote}
            disabled={!selectedNote}
          >
            <FileText className="h-4 w-4" />
            <span>Current Note</span>
          </Button>

          <Button
            variant="ghost"
            className="w-full justify-start gap-2 h-9"
            onClick={handleSyncCurrentFolder}
            disabled={!selectedNote?.folderId}
          >
            <Folder className="h-4 w-4" />
            <span>Current Folder</span>
          </Button>

          <Button
            variant="ghost"
            className="w-full justify-start gap-2 h-9"
            onClick={handleOpenFolderPicker}
          >
            <Folder className="h-4 w-4" />
            <span>Select Folders...</span>
          </Button>

          <div className="h-px bg-border my-1" />

          <Button
            variant="ghost"
            className="w-full justify-start gap-2 h-9"
            onClick={handleSyncGlobal}
          >
            <Globe className="h-4 w-4" />
            <span>Global (All Notes)</span>
          </Button>
        </PopoverContent>
      </Popover>

      <Dialog open={showFolderPicker} onOpenChange={setShowFolderPicker}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Folders to Sync</DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[300px] pr-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-2 rounded-md hover:bg-accent">
                <Checkbox
                  id="quick-notes"
                  checked={includeQuickNotes}
                  onCheckedChange={(checked) => setIncludeQuickNotes(checked === true)}
                />
                <label
                  htmlFor="quick-notes"
                  className="flex items-center gap-2 flex-1 cursor-pointer"
                >
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span>Quick Notes</span>
                </label>
              </div>

              {folders.map((folder) => (
                <div
                  key={folder.id}
                  className="flex items-center gap-2 p-2 rounded-md hover:bg-accent"
                >
                  <Checkbox
                    id={folder.id}
                    checked={selectedFolderIds.has(folder.id)}
                    onCheckedChange={() => toggleFolder(folder.id)}
                  />
                  <label
                    htmlFor={folder.id}
                    className="flex items-center gap-2 flex-1 cursor-pointer"
                  >
                    <Folder
                      className="h-4 w-4"
                      style={{ color: folder.color || '#888' }}
                    />
                    <span className="truncate">{folder.name}</span>
                  </label>
                </div>
              ))}

              {folders.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No folders available
                </p>
              )}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFolderPicker(false)}>
              Cancel
            </Button>
            <Button onClick={handleSyncSelectedFolders}>
              <Check className="h-4 w-4 mr-2" />
              Sync Selected
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
