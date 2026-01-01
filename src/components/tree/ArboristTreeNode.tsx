import React from 'react';
import { NodeRendererProps } from 'react-arborist';
import { ArboristNode } from '@/lib/arborist/types';
import {
    ChevronRight,
    ChevronDown,
    Folder as FolderIcon,
    FolderOpen,
    FileText,
    MoreVertical,
    Star,
    AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ENTITY_ICONS, ENTITY_COLORS } from '@/lib/types/entityTypes';
import { getDisplayName } from '@/lib/utils/titleParser';

interface ArboristTreeNodeProps extends NodeRendererProps<ArboristNode> {
    onContextMenu?: (node: ArboristNode, e: React.MouseEvent) => void;
    isHovered?: boolean;
}

export function ArboristTreeNode({
    node,
    style,
    dragHandle,
    onContextMenu,
    isHovered = false,
}: ArboristTreeNodeProps) {
    const data = node.data;
    const isFolder = data.type === 'folder';
    const isNote = data.type === 'note';

    // Icon selection
    const Icon = isNote && data.isEntity && data.entityKind
        ? ENTITY_ICONS[data.entityKind]
        : isNote
            ? FileText
            : node.isOpen
                ? FolderOpen
                : FolderIcon;

    const iconColor = data.effectiveColor;

    // Kind mismatch detection (note.entityKind !== folder.inheritedKind)
    const hasKindMismatch = isNote &&
        data.isEntity &&
        data.entityKind &&
        (data.folderId || data.noteData?.folderId) &&
        data.inheritedKind &&
        data.entityKind !== data.inheritedKind;

    return (
        <div
            ref={dragHandle}
            style={{
                ...style,
                paddingLeft: `${(node.level || 0) * 20}px`,
            }}
            className={cn(
                "relative flex items-center gap-1 h-8 w-full group/node pr-2",
                node.isSelected && "bg-accent",
                isHovered && "bg-muted"
            )}
            onClick={() => node.isInternal && node.toggle()}
        >
            {/* Tree connector lines */}
            {node.level > 0 && (
                <>
                    {/* Vertical line */}
                    <div
                        className="absolute top-0 bottom-0 w-[2px] opacity-40"
                        style={{
                            left: `${(node.level - 1) * 20 + 10}px`,
                            borderLeft: `2px solid ${iconColor}`,
                        }}
                    />
                    {/* Horizontal connector */}
                    <div
                        className="absolute top-[16px] w-3 h-[2px] opacity-40"
                        style={{
                            left: `${(node.level - 1) * 20 + 10}px`,
                            backgroundColor: iconColor,
                        }}
                    />
                </>
            )}

            {/* Chevron for folders */}
            {isFolder && (
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                        "h-6 w-6 p-0 shrink-0 z-10",
                        !node.data.children?.length && "invisible"
                    )}
                    onClick={(e) => {
                        e.stopPropagation();
                        node.toggle();
                    }}
                >
                    {node.isOpen ? (
                        <ChevronDown className="h-3 w-3" />
                    ) : (
                        <ChevronRight className="h-3 w-3" />
                    )}
                </Button>
            )}

            {/* Spacer for notes (align with folders) */}
            {isNote && <div className="h-6 w-6 shrink-0" />}

            {/* Icon */}
            <Icon
                className="h-4 w-4 shrink-0 z-10"
                style={{ color: iconColor }}
            />

            {/* Fantasy Date Badge (if created from calendar) */}
            {data.fantasyDate && (
                <span className="text-[9px] text-muted-foreground font-mono shrink-0 z-10 opacity-70">
                    {`D${data.fantasyDate.day}.M${data.fantasyDate.month}`}
                </span>
            )}

            {/* Display name */}
            <span className="truncate text-sm flex-1 z-10">
                {getDisplayName(data.name) || (isFolder ? "New Folder" : "Untitled Note")}
            </span>

            {/* Entity badge */}
            {data.entityKind && ENTITY_COLORS[data.entityKind] && (
                <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 z-10"
                    style={{
                        backgroundColor: `hsl(var(--entity-${data.entityKind.toLowerCase().replace('_', '-')}) / 0.2)`,
                        color: `hsl(var(--entity-${data.entityKind.toLowerCase().replace('_', '-')}))`,
                    }}
                >
                    {data.entitySubtype
                        ? `${data.entityKind}:${data.entitySubtype}`
                        : data.entityKind}
                </span>
            )}

            {/* Kind mismatch warning */}
            {hasKindMismatch && (
                <AlertTriangle
                    className="h-3 w-3 shrink-0 text-amber-500 z-10"
                />
            )}

            {/* Favorite star */}
            {isNote && data.favorite && (
                <Star className="h-3 w-3 shrink-0 fill-yellow-400 text-yellow-400 z-10" />
            )}

            {/* Context menu trigger (visible on hover) */}
            <div className="opacity-0 group-hover/node:opacity-100 transition-opacity z-10">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                        e.stopPropagation();
                        onContextMenu?.(data, e);
                    }}
                >
                    <MoreVertical className="h-3 w-3" />
                </Button>
            </div>
        </div>
    );
}
