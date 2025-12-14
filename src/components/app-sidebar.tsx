import * as React from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder as FolderIcon,
  FolderOpen,
  Plus,
  MoreVertical,
  Star,
  StarOff,
  Link as LinkIcon,
  Link2,
  ArrowRight,
  X,
  FileText,
  Search,
  FolderPlus,
  Check,
  Clock,
  User,
  MapPin,
  Users,
  Package,
  Flag,
  Film,
  Calendar,
  Lightbulb,
  AlertTriangle,
  Pencil,
} from "lucide-react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarRail,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useNotes, FolderWithChildren, Note } from "@/contexts/NotesContext";
import { ENTITY_COLORS, ENTITY_SUBTYPES, EntityKind, getSubtypesForKind } from "@/lib/entities/entityTypes";
import { getDisplayName, parseEntityFromTitle, parseFolderEntityFromName, formatSubtypeFolderName } from "@/lib/entities/titleParser";
import { useLinkIndex } from "@/hooks/useLinkIndex";
import { BacklinksPanel } from "@/components/BacklinksPanel";
import { OutgoingLinksPanel } from "@/components/OutgoingLinksPanel";

// Entity kind icons mapping
const ENTITY_ICONS: Record<EntityKind, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  CHARACTER: User,
  LOCATION: MapPin,
  NPC: Users,
  ITEM: Package,
  FACTION: Flag,
  SCENE: Film,
  EVENT: Calendar,
  CONCEPT: Lightbulb,
};

// Entity types for folder creation menu
const ENTITY_TYPES: Array<{ kind: EntityKind; label: string }> = [
  { kind: 'CHARACTER', label: 'Character Folder' },
  { kind: 'LOCATION', label: 'Location Folder' },
  { kind: 'NPC', label: 'NPC Folder' },
  { kind: 'ITEM', label: 'Item Folder' },
  { kind: 'FACTION', label: 'Faction Folder' },
  { kind: 'SCENE', label: 'Scene Folder' },
  { kind: 'EVENT', label: 'Event Folder' },
  { kind: 'CONCEPT', label: 'Concept Folder' },
];

// Color palette for folders
const DEFAULT_COLORS = [
  "#10b981", "#3b82f6", "#8b5cf6", "#ec4899",
  "#f59e0b", "#ef4444", "#14b8a6", "#6366f1"
];

// Reusable rename input component
interface RenameInputProps {
  initialValue: string;
  onSave: (newName: string) => void;
  onCancel: () => void;
  placeholder?: string;
  showEntityHint?: boolean;
  cursorAfterPipe?: boolean; // Position cursor after | for entity prefix
  deleteOnEmpty?: boolean; // Delete note if empty on cancel
  onDelete?: () => void;
}

function RenameInput({ 
  initialValue, 
  onSave, 
  onCancel, 
  placeholder, 
  showEntityHint,
  cursorAfterPipe,
  deleteOnEmpty,
  onDelete,
}: RenameInputProps) {
  const [value, setValue] = React.useState(initialValue);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      if (cursorAfterPipe && initialValue.includes('|')) {
        // Position cursor after the pipe character
        const pipeIndex = initialValue.indexOf('|') + 1;
        inputRef.current.setSelectionRange(pipeIndex, pipeIndex);
      } else {
        inputRef.current.select();
      }
    }
  }, [cursorAfterPipe, initialValue]);

  const handleSubmit = () => {
    const trimmed = value.trim();
    // Check if it's just a prefix like "[CHARACTER|" or "[CHARACTER:ALLY|" with no name
    const isEmptyEntityPrefix = /^\[[A-Z_]+(?::[A-Z_]+)?\|?\]?$/.test(trimmed) || trimmed.endsWith('|');
    
    if (isEmptyEntityPrefix || !trimmed) {
      // Empty or just prefix - cancel or delete
      if (deleteOnEmpty && onDelete) {
        onDelete();
      } else {
        onCancel();
      }
      return;
    }
    
    // Complete the entity syntax if needed (e.g., "[CHARACTER:ALLY|Jon Snow" → "[CHARACTER:ALLY|Jon Snow]")
    let finalValue = trimmed;
    if (trimmed.match(/^\[[A-Z_]+(?::[A-Z_]+)?\|[^\]]+$/) && !trimmed.endsWith(']')) {
      finalValue = trimmed + ']';
    }
    
    if (finalValue !== initialValue) {
      onSave(finalValue);
    } else {
      onCancel();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (deleteOnEmpty && onDelete) {
        onDelete();
      } else {
        onCancel();
      }
    }
  };

  return (
    <div className="flex items-center gap-2 px-1 py-1 w-full">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleSubmit}
        placeholder={placeholder || "Enter name..."}
        className="h-7 text-sm flex-1"
      />
      {showEntityHint && (
        <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
          [KIND|Name]
        </span>
      )}
    </div>
  );
}

// Entity folder creation dropdown menu
function EntityFolderCreationMenu() {
  const { createFolder } = useNotes();
  const [isOpen, setIsOpen] = React.useState(false);

  const handleCreateEntityFolder = (kind: EntityKind) => {
    createFolder(`[${kind}]`, undefined, {
      entityKind: kind,
      isTypedRoot: true,
      color: ENTITY_COLORS[kind],
    });
    setIsOpen(false);
  };

  const handleCreateRegularFolder = () => {
    createFolder("New Folder");
    setIsOpen(false);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
          <FolderPlus className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-popover">
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
          Entity Folders
        </div>
        {ENTITY_TYPES.map(({ kind, label }) => {
          const Icon = ENTITY_ICONS[kind];
          return (
            <DropdownMenuItem
              key={kind}
              onClick={() => handleCreateEntityFolder(kind)}
              className="gap-2"
            >
              <Icon className="h-4 w-4" style={{ color: ENTITY_COLORS[kind] }} />
              <span>{label}</span>
              <span
                className="ml-auto text-[10px] px-1.5 py-0.5 rounded font-medium"
                style={{
                  backgroundColor: `${ENTITY_COLORS[kind]}20`,
                  color: ENTITY_COLORS[kind],
                }}
              >
                {kind}
              </span>
            </DropdownMenuItem>
          );
        })}
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={handleCreateRegularFolder} className="gap-2">
          <FolderIcon className="h-4 w-4" />
          <span>Regular Folder</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Subtype folder creation dropdown menu (shown inside typed folders)
interface SubtypeFolderMenuProps {
  parentId: string;
  parentKind: EntityKind;
  onComplete?: () => void;
}

function SubtypeFolderMenu({ parentId, parentKind, onComplete }: SubtypeFolderMenuProps) {
  const { createFolder } = useNotes();
  const [isOpen, setIsOpen] = React.useState(false);
  
  const subtypes = getSubtypesForKind(parentKind);
  
  const handleCreateSubtypeFolder = (subtype: string) => {
    createFolder(formatSubtypeFolderName(parentKind, subtype), parentId, {
      entityKind: parentKind,
      entitySubtype: subtype,
      isSubtypeRoot: true,
      color: ENTITY_COLORS[parentKind],
    });
    setIsOpen(false);
    onComplete?.();
  };

  const handleCreateRegularSubfolder = () => {
    createFolder("New Folder", parentId);
    setIsOpen(false);
    onComplete?.();
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
          <FolderPlus className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-popover">
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
          {parentKind} Subtypes
        </div>
        {subtypes.map((subtype) => (
          <DropdownMenuItem
            key={subtype}
            onClick={() => handleCreateSubtypeFolder(subtype)}
            className="gap-2"
          >
            <FolderIcon className="h-4 w-4" style={{ color: ENTITY_COLORS[parentKind] }} />
            <span>{subtype}</span>
            <span
              className="ml-auto text-[10px] px-1.5 py-0.5 rounded font-medium"
              style={{
                backgroundColor: `${ENTITY_COLORS[parentKind]}20`,
                color: ENTITY_COLORS[parentKind],
              }}
            >
              {parentKind}:{subtype}
            </span>
          </DropdownMenuItem>
        ))}
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={handleCreateRegularSubfolder} className="gap-2">
          <FolderIcon className="h-4 w-4" />
          <span>Regular Subfolder</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface FolderItemProps {
  folder: FolderWithChildren;
  depth?: number;
  parentColor?: string;
}

function FolderItem({ folder, depth = 0, parentColor }: FolderItemProps) {
  const { selectNote, createNote, createFolder, updateFolder, deleteFolder, updateNote, deleteNote, state } = useNotes();
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);
  const [isRenaming, setIsRenaming] = React.useState(false);
  const [newlyCreatedNoteId, setNewlyCreatedNoteId] = React.useState<string | null>(null);

  // Color inheritance: folder.color → parentColor → default palette
  const folderColor = folder.color || parentColor || DEFAULT_COLORS[depth % DEFAULT_COLORS.length];
  const hasContent = folder.subfolders.length > 0 || folder.notes.length > 0;

  // Get effective kind for this folder (for subtype menu and note creation)
  const effectiveKind = folder.entityKind || folder.inheritedKind;
  const effectiveSubtype = folder.entitySubtype || folder.inheritedSubtype;

  const handleCreateSubfolder = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    createFolder("New Folder", folder.id);
    setIsExpanded(true);
  };

  const handleCreateNote = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    // Get the inherited kind and subtype for this folder
    const kind = folder.entityKind || folder.inheritedKind;
    const subtype = folder.entitySubtype || folder.inheritedSubtype;
    
    let newNote: ReturnType<typeof createNote>;
    if (kind && subtype) {
      // Create note with kind:subtype prefix for subtyped folders
      newNote = createNote(folder.id, `[${kind}:${subtype}|`);
    } else if (kind) {
      // Create note with just kind prefix for typed folders
      newNote = createNote(folder.id, `[${kind}|`);
    } else {
      newNote = createNote(folder.id);
    }
    
    setIsExpanded(true);
    
    // Trigger auto-rename for the new note (only for typed folders)
    if (newNote && kind) {
      setNewlyCreatedNoteId(newNote.id);
    }
  };

  const handleChangeColor = (e: React.MouseEvent, color: string) => {
    e.preventDefault();
    e.stopPropagation();
    updateFolder(folder.id, { color });
  };

  const handleDeleteFolder = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    deleteFolder(folder.id);
  };

  const handleRename = (newName: string) => {
    const parsed = parseFolderEntityFromName(newName);
    updateFolder(folder.id, {
      name: newName,
      entityKind: parsed?.kind,
      entityLabel: parsed?.label,
      isTypedRoot: parsed?.isTypedRoot,
      color: parsed?.kind && !folder.entityKind ? ENTITY_COLORS[parsed.kind] : folder.color,
    });
    setIsRenaming(false);
  };

  const handleStartRename = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsRenaming(true);
  };

  return (
    <div className="relative w-full">
      {/* Tree lines - matching folder color */}
      {depth > 0 && (
        <>
          {/* Vertical line */}
          <div
            className="absolute top-0 bottom-0 w-[2px] opacity-40 pointer-events-none"
            style={{
              left: `${(depth - 1) * 20 + 10}px`,
              borderLeft: `2px solid ${folderColor}`,
            }}
          />
          {/* Horizontal connector */}
          <div
            className="absolute top-[18px] w-3 h-[2px] opacity-40 pointer-events-none"
            style={{
              left: `${(depth - 1) * 20 + 10}px`,
              backgroundColor: folderColor,
            }}
          />
        </>
      )}

      <SidebarMenuItem
        className="relative z-10"
        style={{ paddingLeft: `${depth * 20}px` }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded} className="group/collapsible w-full">
          {isRenaming ? (
            <RenameInput
              initialValue={folder.name}
              onSave={handleRename}
              onCancel={() => setIsRenaming(false)}
              placeholder="Folder name"
              showEntityHint={folder.isTypedRoot || folder.entityKind !== undefined}
            />
          ) : (
            <div className="flex items-center gap-1 w-full">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-6 w-6 p-0 shrink-0", !hasContent && "invisible")}
                  disabled={!hasContent}
                >
                  {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </Button>
              </CollapsibleTrigger>

              <div className="flex-1 flex items-center gap-2 min-w-0">
                {isExpanded ? (
                  <FolderOpen className="h-4 w-4 shrink-0" style={{ color: folderColor }} />
                ) : (
                  <FolderIcon className="h-4 w-4 shrink-0" style={{ color: folderColor }} />
                )}
                <span className="truncate text-sm font-medium">{getDisplayName(folder.name) || "New Folder"}</span>
                {/* Entity badges for typed folders */}
                {folder.entityKind && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
                    style={{
                      backgroundColor: `${ENTITY_COLORS[folder.entityKind]}20`,
                      color: ENTITY_COLORS[folder.entityKind],
                    }}
                  >
                    {folder.entitySubtype ? `${folder.entityKind}:${folder.entitySubtype}` : folder.entityKind}
                  </span>
                )}
              </div>

              {/* Action buttons - visible on hover */}
              <div className={cn("flex items-center shrink-0 gap-1 transition-opacity", !isHovered && "opacity-0")}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 p-0"
                  onClick={handleCreateNote}
                  title="Add note"
                >
                  <Plus className="h-3 w-3" />
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
                      <MoreVertical className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 bg-popover">
                    <DropdownMenuItem onClick={handleStartRename}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Rename folder
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    {/* Show subtype menu for typed folders, regular subfolder otherwise */}
                    {effectiveKind ? (
                      <div className="px-2 py-1">
                        <div className="text-xs text-muted-foreground mb-1.5">Create Subfolder</div>
                        <div className="flex flex-col gap-1">
                          {getSubtypesForKind(effectiveKind).slice(0, 4).map((subtype) => (
                            <DropdownMenuItem
                              key={subtype}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                createFolder(formatSubtypeFolderName(effectiveKind, subtype), folder.id, {
                                  entityKind: effectiveKind,
                                  entitySubtype: subtype,
                                  isSubtypeRoot: true,
                                  color: ENTITY_COLORS[effectiveKind],
                                });
                                setIsExpanded(true);
                              }}
                              className="gap-2"
                            >
                              <FolderIcon className="h-4 w-4" style={{ color: ENTITY_COLORS[effectiveKind] }} />
                              <span>{subtype}</span>
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuItem onClick={handleCreateSubfolder} className="gap-2">
                            <FolderPlus className="mr-2 h-4 w-4" />
                            Regular subfolder
                          </DropdownMenuItem>
                        </div>
                      </div>
                    ) : (
                      <DropdownMenuItem onClick={handleCreateSubfolder}>
                        <FolderPlus className="mr-2 h-4 w-4" />
                        New subfolder
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuItem onClick={handleCreateNote}>
                      <Plus className="mr-2 h-4 w-4" />
                      New note
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    {/* Color picker */}
                    <div className="p-2">
                      <div className="text-sm font-medium mb-2">Folder Color</div>
                      <div className="flex flex-wrap gap-2">
                        {DEFAULT_COLORS.map((color) => (
                          <button
                            key={color}
                            onClick={(e) => handleChangeColor(e, color)}
                            className="w-6 h-6 rounded border-2 hover:scale-110 transition-transform cursor-pointer"
                            style={{
                              backgroundColor: color,
                              borderColor: color === folderColor ? "hsl(var(--foreground))" : "transparent",
                            }}
                            aria-label={`Change color to ${color}`}
                          />
                        ))}
                      </div>
                    </div>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem onClick={handleDeleteFolder} className="text-destructive focus:text-destructive">
                      <X className="mr-2 h-4 w-4" />
                      Delete folder
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )}

          <CollapsibleContent>
            <SidebarMenuSub className="ml-0 pl-0 border-l-0">
              {/* Render subfolders recursively - passing color down */}
              {folder.subfolders.map((subfolder) => (
                <FolderItem
                  key={subfolder.id}
                  folder={subfolder}
                  depth={depth + 1}
                  parentColor={folderColor}
                />
              ))}

              {/* Render notes in this folder */}
              {folder.notes.map((note) => (
                <NoteItem
                  key={note.id}
                  note={note}
                  depth={depth + 1}
                  folderColor={folderColor}
                  autoRename={note.id === newlyCreatedNoteId}
                  onRenameComplete={() => setNewlyCreatedNoteId(null)}
                />
              ))}

              {!hasContent && (
                <div
                  className="text-xs text-muted-foreground py-1 italic"
                  style={{ paddingLeft: `${(depth + 1) * 20 + 16}px` }}
                >
                  Empty folder
                </div>
              )}
            </SidebarMenuSub>
          </CollapsibleContent>
        </Collapsible>
      </SidebarMenuItem>
    </div>
  );
}

interface NoteItemProps {
  note: Note;
  depth?: number;
  folderColor?: string;
  autoRename?: boolean;
  onRenameComplete?: () => void;
}

function NoteItem({ note, depth = 0, folderColor, autoRename, onRenameComplete }: NoteItemProps) {
  const { selectNote, updateNote, deleteNote, state, getEntityNote } = useNotes();
  const [isHovered, setIsHovered] = React.useState(false);
  const [isRenaming, setIsRenaming] = React.useState(autoRename || false);
  const isActive = state.selectedNoteId === note.id;
  
  // Start renaming when autoRename becomes true
  React.useEffect(() => {
    if (autoRename) {
      setIsRenaming(true);
    }
  }, [autoRename]);

  // Parse entity info for display
  const displayName = getDisplayName(note.title);
  const EntityIcon = note.isEntity && note.entityKind ? ENTITY_ICONS[note.entityKind] : FileText;
  const entityColor = note.isEntity && note.entityKind ? ENTITY_COLORS[note.entityKind] : undefined;
  
  // Check for kind mismatch with folder
  const folder = note.folderId ? state.folders.find(f => f.id === note.folderId) : undefined;
  const folderKind = folder?.entityKind || folder?.inheritedKind;
  const hasKindMismatch = note.isEntity && note.entityKind && folderKind && note.entityKind !== folderKind;

  const handleCopyLink = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/note/${note.id}`;
    navigator.clipboard.writeText(url);
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    updateNote(note.id, { favorite: !note.favorite });
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    deleteNote(note.id);
  };

  const handleRename = (newTitle: string) => {
    const parsed = parseEntityFromTitle(newTitle);
    updateNote(note.id, {
      title: newTitle,
      entityKind: parsed?.kind,
      entityLabel: parsed?.label,
      isEntity: parsed !== null && parsed.label !== undefined,
    });
    setIsRenaming(false);
    onRenameComplete?.();
  };

  const handleCancelRename = () => {
    setIsRenaming(false);
    onRenameComplete?.();
  };

  const handleDeleteNewNote = () => {
    deleteNote(note.id);
    onRenameComplete?.();
  };

  const handleStartRename = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsRenaming(true);
  };
  
  // Check if this is an auto-created entity note (has prefix like "[CHARACTER|" or "[CHARACTER:ALLY|")
  const isAutoCreatedEntity = Boolean(autoRename && /^\[[A-Z_]+(?::[A-Z_]+)?\|$/.test(note.title));

  return (
    <div className="relative w-full">
      {/* Tree line connector - inherits folder color */}
      {depth > 0 && folderColor && (
        <>
          <div
            className="absolute top-0 bottom-0 w-[2px] opacity-40 pointer-events-none"
            style={{
              left: `${(depth - 1) * 20 + 10}px`,
              borderLeft: `2px solid ${folderColor}`,
            }}
          />
          <div
            className="absolute top-[18px] w-3 h-[2px] opacity-40 pointer-events-none"
            style={{
              left: `${(depth - 1) * 20 + 10}px`,
              backgroundColor: folderColor,
            }}
          />
        </>
      )}

      <SidebarMenuItem
        className="relative z-10"
        style={{ paddingLeft: `${depth * 20}px` }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {isRenaming ? (
          <div className="flex items-center gap-1 w-full">
            <div className="h-6 w-6" />
            <RenameInput
              initialValue={note.title}
              onSave={handleRename}
              onCancel={handleCancelRename}
              placeholder="Enter entity name..."
              showEntityHint={note.isEntity || isAutoCreatedEntity}
              cursorAfterPipe={isAutoCreatedEntity}
              deleteOnEmpty={isAutoCreatedEntity}
              onDelete={handleDeleteNewNote}
            />
          </div>
        ) : (
          <div className="flex items-center gap-1 w-full">
            <div className="h-6 w-6" /> {/* Spacer for alignment with folders */}

            <SidebarMenuButton
              onClick={() => selectNote(note.id)}
              isActive={isActive}
              className={cn("flex-1 justify-start gap-2 h-8 min-w-0")}
            >
              <EntityIcon 
                className="h-4 w-4 shrink-0" 
                style={entityColor ? { color: entityColor } : undefined}
              />
              <span className="truncate text-sm">{displayName || "Untitled Note"}</span>
              {/* Entity badge with optional subtype */}
              {note.isEntity && note.entityKind && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
                  style={{
                    backgroundColor: `${ENTITY_COLORS[note.entityKind]}20`,
                    color: ENTITY_COLORS[note.entityKind],
                  }}
                >
                  {note.entitySubtype ? `${note.entityKind}:${note.entitySubtype}` : note.entityKind}
                </span>
              )}
              {/* Kind mismatch warning */}
              {hasKindMismatch && (
                <span title="Entity kind does not match folder">
                  <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500" />
                </span>
              )}
              {note.favorite && <Star className="h-3 w-3 shrink-0 fill-yellow-400 text-yellow-400 ml-auto" />}
            </SidebarMenuButton>

            {/* Action button - visible on hover */}
            <div className={cn("flex items-center shrink-0 transition-opacity", !isHovered && "opacity-0")}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
                    <MoreVertical className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-popover">
                  <DropdownMenuItem onClick={handleStartRename}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Rename note
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem onClick={handleToggleFavorite}>
                    {note.favorite ? (
                      <>
                        <StarOff className="mr-2 h-4 w-4" />
                        Remove from favorites
                      </>
                    ) : (
                      <>
                        <Star className="mr-2 h-4 w-4" />
                        Add to favorites
                      </>
                    )}
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={handleCopyLink}>
                    <LinkIcon className="mr-2 h-4 w-4" />
                    Copy link
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
                    <X className="mr-2 h-4 w-4" />
                    Delete note
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}
      </SidebarMenuItem>
    </div>
  );
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const {
    state,
    folderTree,
    globalNotes,
    favoriteNotes,
    createNote,
    createFolder,
    setSearchQuery,
    selectNote,
    selectedNote,
  } = useNotes();

  // Link index for backlinks/outgoing links
  const { getBacklinks, getOutgoingLinks, findNoteByTitle } = useLinkIndex(state.notes);
  
  const backlinks = React.useMemo(() => 
    selectedNote ? getBacklinks(selectedNote) : [], 
    [selectedNote, getBacklinks]
  );
  
  const outgoingLinks = React.useMemo(() => 
    selectedNote ? getOutgoingLinks(selectedNote.id) : [], 
    [selectedNote, getOutgoingLinks]
  );

  // Navigate to a note by title (for link panels)
  const handleNavigateToNote = React.useCallback((title: string, createIfNotExists?: boolean) => {
    const existingNote = findNoteByTitle(title);
    if (existingNote) {
      selectNote(existingNote.id);
    } else if (createIfNotExists) {
      const newNote = createNote(undefined, title);
      selectNote(newNote.id);
    }
  }, [findNoteByTitle, selectNote, createNote]);

  return (
    <Sidebar className="border-r border-sidebar-border" {...props}>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <span className="font-serif font-semibold text-lg text-sidebar-foreground">Inklings</span>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search notes..."
            className="pl-9 bg-sidebar-accent border-0 focus-visible:ring-1 focus-visible:ring-sidebar-ring"
            value={state.searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0 px-2">
        <Tabs defaultValue="notes" className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-3 mb-2">
            <TabsTrigger value="notes" className="text-xs">Notes</TabsTrigger>
            <TabsTrigger value="backlinks" className="text-xs gap-1">
              <Link2 className="h-3 w-3" />
              <span className="hidden sm:inline">Back</span>
            </TabsTrigger>
            <TabsTrigger value="outgoing" className="text-xs gap-1">
              <ArrowRight className="h-3 w-3" />
              <span className="hidden sm:inline">Out</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notes" className="flex-1 mt-0 space-y-4">
            {/* Favorites */}
            {favoriteNotes.length > 0 && (
              <SidebarGroup>
                <SidebarGroupLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-2">
                  Favorites
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {favoriteNotes.map((note) => (
                      <NoteItem key={note.id} note={note} depth={0} />
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}

            {/* Quick Notes (global notes without folder) */}
            <SidebarGroup>
              <div className="flex items-center justify-between px-2 mb-1">
                <SidebarGroupLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider p-0">
                  Quick Notes
                </SidebarGroupLabel>
                <Button variant="ghost" size="icon" className="h-5 w-5 p-0" onClick={() => createNote()}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <SidebarGroupContent>
                <SidebarMenu>
                  {globalNotes.length === 0 ? (
                    <div className="px-3 py-4 text-center text-muted-foreground">
                      <FileText className="h-6 w-6 mx-auto mb-2 opacity-50" />
                      <p className="text-xs">No notes yet</p>
                    </div>
                  ) : (
                    globalNotes.map((note) => (
                      <NoteItem key={note.id} note={note} depth={0} />
                    ))
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Folders section with entity creation menu */}
            <SidebarGroup>
              <div className="flex items-center justify-between px-2 mb-1">
                <SidebarGroupLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider p-0">
                  Folders
                </SidebarGroupLabel>
                <EntityFolderCreationMenu />
              </div>
              <SidebarGroupContent>
                <SidebarMenu>
                  {folderTree.length === 0 ? (
                    <div className="px-3 py-4 text-center text-muted-foreground">
                      <FolderIcon className="h-6 w-6 mx-auto mb-2 opacity-50" />
                      <p className="text-xs">No folders yet</p>
                      <p className="text-[10px] mt-1">Click + to create entity folder</p>
                    </div>
                  ) : (
                    folderTree.map((folder) => (
                      <FolderItem key={folder.id} folder={folder} depth={0} />
                    ))
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </TabsContent>

          <TabsContent value="backlinks" className="flex-1 mt-0">
            <BacklinksPanel 
              backlinks={backlinks} 
              onNavigate={handleNavigateToNote} 
            />
          </TabsContent>

          <TabsContent value="outgoing" className="flex-1 mt-0">
            <OutgoingLinksPanel 
              outgoingLinks={outgoingLinks} 
              notes={state.notes}
              onNavigate={handleNavigateToNote} 
            />
          </TabsContent>
        </Tabs>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{state.notes.length} notes</span>
          {state.isSaving ? (
            <span className="flex items-center gap-1 animate-pulse">
              <Clock className="h-3 w-3" />
              Saving...
            </span>
          ) : state.lastSaved ? (
            <span className="flex items-center gap-1">
              <Check className="h-3 w-3 text-green-500" />
              Saved
            </span>
          ) : null}
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

export default AppSidebar;
