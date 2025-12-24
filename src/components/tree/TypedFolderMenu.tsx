/**
 * TypedFolderMenu - Context-aware subfolder creation menu
 * 
 * When right-clicking a typed folder, shows a menu of allowed subfolder types
 * based on the folder's schema. Each menu item creates a subfolder with the
 * appropriate entity type AND automatically creates the semantic relationship.
 */

import React from 'react';
import {
    DropdownMenuItem,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { folderSchemaRegistry } from '@/lib/folders/schema-registry';
import { ENTITY_COLORS, type EntityKind } from '@/lib/entities/entityTypes';
import type { Folder } from '@/contexts/NotesContext';
import {
    User,
    Users,
    MapPin,
    Map,
    Home,
    Landmark,
    Package,
    Flag,
    Calendar,
    Crown,
    Handshake,
    Swords,
    Heart,
    Link,
    History,
    Puzzle,
    GitBranch,
    Eye,
    ArrowLeft,
    ArrowRight,
    Film,
    Lightbulb,
    Drama,
    BookOpen,
    Waves,
    Book,
    Hourglass,
    FolderPlus,
    Building,
    UserCircle,
    Scroll,
    Zap,
    Sparkles,
    Split,
    type LucideIcon,
} from 'lucide-react';

/**
 * Icon mapping for subfolder types
 */
const ICON_MAP: Record<string, LucideIcon> = {
    User,
    Users,
    MapPin,
    Map,
    Home,
    Landmark,
    Package,
    Flag,
    Calendar,
    Crown,
    Handshake,
    Swords,
    Heart,
    Link,
    History,
    Puzzle,
    GitBranch,
    Eye,
    ArrowLeft,
    ArrowRight,
    Film,
    Lightbulb,
    Drama,
    BookOpen,
    Waves,
    Book,
    Hourglass,
    FolderPlus,
    Building,
    UserCircle,
    Scroll,
    Zap,
    Sparkles,
    Split,
};

interface TypedFolderMenuProps {
    /** The parent folder to create subfolders under */
    parentFolder: Folder;

    /** Callback when a subfolder should be created */
    onCreateSubfolder: (
        entityKind: EntityKind,
        subtype?: string,
        suggestedName?: string
    ) => void;

    /** Callback when a note should be created */
    onCreateNote?: (
        entityKind?: EntityKind,
        subtype?: string
    ) => void;

    /** Whether to show as a submenu (for nested context menus) */
    asSubmenu?: boolean;
}

/**
 * Get the icon component for an icon name
 */
function getIcon(iconName?: string): LucideIcon {
    if (!iconName) return FolderPlus;
    return ICON_MAP[iconName] || FolderPlus;
}

/**
 * Get a color for the icon based on entity kind
 */
function getIconColor(kind: EntityKind): string {
    return ENTITY_COLORS[kind] || '#8b5cf6';
}

/**
 * Main TypedFolderMenu component
 */
export function TypedFolderMenu({
    parentFolder,
    onCreateSubfolder,
    onCreateNote,
    asSubmenu = false,
}: TypedFolderMenuProps) {
    // If folder doesn't have an entity kind, show basic options
    if (!parentFolder.entityKind) {
        return (
            <DropdownMenuItem onClick={() => onCreateSubfolder('CHARACTER' as EntityKind)}>
                <FolderPlus className="mr-2 h-4 w-4" />
                Add Subfolder
            </DropdownMenuItem>
        );
    }

    // Get allowed subfolders from schema
    const allowedSubfolders = folderSchemaRegistry.getAllowedSubfolders(
        parentFolder.entityKind,
        parentFolder.entitySubtype
    );

    // Get allowed note types from schema
    const allowedNoteTypes = folderSchemaRegistry.getAllowedNoteTypes(
        parentFolder.entityKind,
        parentFolder.entitySubtype
    );

    // If no allowed subfolders defined, show default option
    if (allowedSubfolders.length === 0 && allowedNoteTypes.length === 0) {
        return (
            <DropdownMenuItem onClick={() => onCreateSubfolder(parentFolder.entityKind!)}>
                <FolderPlus className="mr-2 h-4 w-4" />
                Add Subfolder
            </DropdownMenuItem>
        );
    }

    const content = (
        <>
            {/* Subfolder creation options */}
            {allowedSubfolders.length > 0 && (
                <>
                    {allowedSubfolders.map((subfolderDef, index) => {
                        const Icon = getIcon(subfolderDef.icon);
                        const color = getIconColor(subfolderDef.entityKind);

                        return (
                            <DropdownMenuItem
                                key={`subfolder-${index}`}
                                onClick={() => onCreateSubfolder(
                                    subfolderDef.entityKind,
                                    subfolderDef.subtype,
                                    subfolderDef.label
                                )}
                                title={subfolderDef.description}
                            >
                                <Icon
                                    className="mr-2 h-4 w-4"
                                    style={{ color }}
                                />
                                <span>Add {subfolderDef.label}</span>
                            </DropdownMenuItem>
                        );
                    })}
                </>
            )}

            {/* Separator if both subfolders and notes available */}
            {allowedSubfolders.length > 0 && allowedNoteTypes.length > 0 && onCreateNote && (
                <DropdownMenuSeparator />
            )}

            {/* Note creation options */}
            {allowedNoteTypes.length > 0 && onCreateNote && (
                <>
                    {allowedNoteTypes.map((noteTypeDef, index) => {
                        const Icon = getIcon(noteTypeDef.icon);
                        const color = getIconColor(noteTypeDef.entityKind);

                        return (
                            <DropdownMenuItem
                                key={`note-${index}`}
                                onClick={() => onCreateNote(
                                    noteTypeDef.entityKind,
                                    noteTypeDef.subtype
                                )}
                            >
                                <Icon
                                    className="mr-2 h-4 w-4"
                                    style={{ color }}
                                />
                                <span>New {noteTypeDef.label}</span>
                            </DropdownMenuItem>
                        );
                    })}
                </>
            )}
        </>
    );

    // If used as a submenu, wrap in submenu components
    if (asSubmenu) {
        return (
            <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                    <FolderPlus className="mr-2 h-4 w-4" />
                    Add Related...
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-56">
                    {content}
                </DropdownMenuSubContent>
            </DropdownMenuSub>
        );
    }

    // Otherwise render items directly
    return <>{content}</>;
}

/**
 * Standalone component for quick type selection (e.g., for toolbars)
 */
export function TypedFolderQuickMenu({
    parentFolder,
    onCreateSubfolder,
}: Pick<TypedFolderMenuProps, 'parentFolder' | 'onCreateSubfolder'>) {
    if (!parentFolder.entityKind) return null;

    const allowedSubfolders = folderSchemaRegistry.getAllowedSubfolders(
        parentFolder.entityKind,
        parentFolder.entitySubtype
    );

    if (allowedSubfolders.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-1 p-2">
            {allowedSubfolders.slice(0, 6).map((subfolderDef, index) => {
                const Icon = getIcon(subfolderDef.icon);
                const color = getIconColor(subfolderDef.entityKind);

                return (
                    <button
                        key={index}
                        onClick={() => onCreateSubfolder(
                            subfolderDef.entityKind,
                            subfolderDef.subtype,
                            subfolderDef.label
                        )}
                        title={`Add ${subfolderDef.label}${subfolderDef.description ? `: ${subfolderDef.description}` : ''}`}
                        className="flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-muted/50 hover:bg-muted transition-colors"
                    >
                        <Icon className="h-3 w-3" style={{ color }} />
                        <span className="max-w-[80px] truncate">{subfolderDef.label}</span>
                    </button>
                );
            })}
        </div>
    );
}

/**
 * Hook to get typed folder menu options for a folder
 */
export function useTypedFolderOptions(folder: Folder | null) {
    if (!folder?.entityKind) {
        return {
            allowedSubfolders: [],
            allowedNoteTypes: [],
            hasSchema: false,
        };
    }

    const schema = folderSchemaRegistry.getSchema(folder.entityKind, folder.entitySubtype);

    return {
        allowedSubfolders: schema?.allowedSubfolders || [],
        allowedNoteTypes: schema?.allowedNoteTypes || [],
        hasSchema: !!schema,
        schema,
    };
}
