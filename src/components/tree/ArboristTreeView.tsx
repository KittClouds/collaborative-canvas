import React, { useRef, useCallback, useMemo, useEffect } from 'react';
import { Tree, TreeApi, NodeApi } from 'react-arborist';
import { ArboristNode } from '@/lib/arborist/types';
import { ArboristTreeNode } from './ArboristTreeNode';
import { useNotes } from '@/contexts/NotesContext';
import { buildArboristTree } from '@/lib/arborist/adapter';

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Pencil, Plus, X, FolderPlus, Star, StarOff, LinkIcon } from 'lucide-react';

interface ArboristTreeViewProps {
    searchTerm?: string;
    className?: string;
}

export function ArboristTreeView({
    searchTerm = '',
    className
}: ArboristTreeViewProps) {
    const {
        folderTree,
        globalNotes,
        createNote,
        createFolder,
        updateNote,
        updateFolder,
        deleteNote,
        deleteFolder,
        selectNote,
    } = useNotes();

    const treeRef = useRef<TreeApi<ArboristNode>>(null);
    const [treeHeight, setTreeHeight] = React.useState(600);
    const [treeWidth, setTreeWidth] = React.useState(300);
    const containerRef = useRef<HTMLDivElement>(null);
    const [contextNode, setContextNode] = React.useState<ArboristNode | null>(null);
    const [contextMenuPos, setContextMenuPos] = React.useState({ x: 0, y: 0 });

    useEffect(() => {
        if (!containerRef.current) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                // Adjust height and width to fill container
                setTreeHeight(entry.contentRect.height || 600);
                setTreeWidth(entry.contentRect.width || 300);
            }
        });

        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    // Build Arborist-compatible tree
    const treeData = useMemo(
        () => buildArboristTree(folderTree, globalNotes),
        [folderTree, globalNotes]
    );

    // Handle node selection (click)
    const handleSelect = useCallback((nodes: NodeApi<ArboristNode>[]) => {
        const node = nodes[0];
        if (!node) return;

        if (node.data.type === 'note') {
            selectNote(node.id);
        }
        // Folders just toggle open/close (handled by Tree component)
    }, [selectNote]);

    // Handle node rename
    const handleRename = useCallback(({ node, name }: { node: any; name: string }) => {
        const nodeId = node.id;
        const nodeData = node.data;
        if (nodeData.type === 'folder') {
            updateFolder(nodeId, { name });
        } else {
            updateNote(nodeId, { title: name });
        }
    }, [updateFolder, updateNote]);

    // Handle node move (drag-and-drop)
    const handleMove = useCallback(({ dragIds, parentId, index }: {
        dragIds: string[];
        parentId: string | null;
        index: number;
    }) => {
        const dragId = dragIds[0];
        const node = treeRef.current?.get(dragId);
        if (!node) return;

        if (node.data.type === 'folder') {
            updateFolder(dragId, { parentId: parentId || undefined });
        } else {
            updateNote(dragId, { folderId: parentId || undefined });
        }
    }, [updateFolder, updateNote]);

    // Handle context menu
    const handleContextMenu = useCallback((node: ArboristNode, e: React.MouseEvent) => {
        e.preventDefault();
        setContextNode(node);
        setContextMenuPos({ x: e.clientX, y: e.clientY });
    }, []);

    // Context menu actions
    const handleDeleteNode = useCallback(() => {
        if (!contextNode) return;
        if (contextNode.type === 'folder') {
            deleteFolder(contextNode.id);
        } else {
            deleteNote(contextNode.id);
        }
        setContextNode(null);
    }, [contextNode, deleteFolder, deleteNote]);

    const handleToggleFavorite = useCallback(() => {
        if (!contextNode || contextNode.type !== 'note') return;
        updateNote(contextNode.id, { favorite: !contextNode.favorite });
        setContextNode(null);
    }, [contextNode, updateNote]);

    const handleCopyLink = useCallback(() => {
        if (!contextNode || contextNode.type !== 'note') return;
        const url = `${window.location.origin}/note/${contextNode.id}`;
        navigator.clipboard.writeText(url);
        setContextNode(null);
    }, [contextNode]);

    const handleCreateNote = useCallback(() => {
        if (!contextNode || contextNode.type !== 'folder') return;
        createNote(contextNode.id);
        setContextNode(null);
    }, [contextNode, createNote]);

    const handleCreateSubfolder = useCallback(() => {
        if (!contextNode || contextNode.type !== 'folder') return;
        createFolder("New Folder", contextNode.id);
        setContextNode(null);
    }, [contextNode, createFolder]);

    // Search filtering
    const searchMatch = useCallback((node: any) => {
        if (!searchTerm) return true;
        const query = searchTerm.toLowerCase();
        return node.data.name.toLowerCase().includes(query);
    }, [searchTerm]);

    return (
        <div ref={containerRef} className={cn("flex-1 overflow-hidden min-h-[400px]", className)}>
            <Tree
                ref={treeRef}
                data={treeData}
                width={treeWidth}
                height={treeHeight}
                rowHeight={32}
                indent={20}
                overscanCount={10}
                searchTerm={searchTerm}
                searchMatch={searchMatch}
                onSelect={handleSelect}
                onRename={handleRename}
                onMove={handleMove}
                disableDrag={false}
                disableDrop={false}
                className="arborist-tree"
            >
                {(props) => (
                    <ArboristTreeNode
                        {...props}
                        onContextMenu={handleContextMenu}
                    />
                )}
            </Tree>

            {/* Context Menu */}
            <DropdownMenu
                open={!!contextNode}
                onOpenChange={(open) => !open && setContextNode(null)}
            >
                <DropdownMenuTrigger asChild>
                    <div
                        style={{
                            position: 'fixed',
                            left: contextMenuPos.x,
                            top: contextMenuPos.y,
                            width: 1,
                            height: 1,
                            visibility: 'hidden'
                        }}
                    />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                    {contextNode?.type === 'folder' ? (
                        <>
                            <DropdownMenuItem onClick={handleCreateNote}>
                                <Plus className="mr-2 h-4 w-4" />
                                New note
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleCreateSubfolder}>
                                <FolderPlus className="mr-2 h-4 w-4" />
                                New subfolder
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => treeRef.current?.edit(contextNode.id)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Rename
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={handleDeleteNode}
                                className="text-destructive focus:text-destructive"
                            >
                                <X className="mr-2 h-4 w-4" />
                                Delete folder
                            </DropdownMenuItem>
                        </>
                    ) : (
                        <>
                            <DropdownMenuItem onClick={() => treeRef.current?.edit(contextNode?.id || '')}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Rename note
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={handleToggleFavorite}>
                                {contextNode?.favorite ? (
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
                            <DropdownMenuItem
                                onClick={handleDeleteNode}
                                className="text-destructive focus:text-destructive"
                            >
                                <X className="mr-2 h-4 w-4" />
                                Delete note
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
