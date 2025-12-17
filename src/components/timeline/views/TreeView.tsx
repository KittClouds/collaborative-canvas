import React from 'react';
import { TimelineItem } from '@/lib/timeline/timelineQueries';
import { NarrativeEntity } from '@/types/narrativeEntities';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ENTITY_COLORS } from '@/lib/entities/entityTypes';
import { Button } from '@/components/ui/button';

interface TreeViewProps {
    items: TimelineItem[];
    onNavigate: (id: string) => void;
    onQuickAdd: (parentId: string, type: string) => void;
}

interface TreeNode {
    item: TimelineItem;
    children: TreeNode[];
}

export function TreeView({ items, onNavigate, onQuickAdd }: TreeViewProps) {
    // Build tree
    const tree = React.useMemo(() => {
        const nodes: Record<string, TreeNode> = {};
        const roots: TreeNode[] = [];

        // Create nodes
        items.forEach(item => {
            nodes[item.id] = { item, children: [] };
        });

        // Link parent/child
        items.forEach(item => {
            const node = nodes[item.id];
            // Check for parent in items
            const parentId =
                (item.entity as any).parentSceneId ||
                (item.entity as any).parentChapterId ||
                (item.entity as any).parentActId ||
                (item.entity as any).parentArcId;

            if (parentId && nodes[parentId]) {
                nodes[parentId].children.push(node);
            } else {
                roots.push(node);
            }
        });

        // Sort logic handled by query engine, but we might want to ensure children are sorted
        return roots;
    }, [items]);

    return (
        <div className="p-4 space-y-2">
            {tree.map(node => (
                <TreeItem
                    key={node.item.id}
                    node={node}
                    onNavigate={onNavigate}
                    onQuickAdd={onQuickAdd}
                />
            ))}
        </div>
    );
}

function TreeItem({ node, onNavigate, onQuickAdd, level = 0 }: { node: TreeNode, onNavigate: any, onQuickAdd: any, level?: number }) {
    const [isOpen, setIsOpen] = React.useState(true);
    const { item, children } = node;
    const hasChildren = children.length > 0;

    return (
        <div className="select-none">
            <div
                className={cn(
                    "flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer group",
                    level === 0 && "font-semibold",
                )}
                style={{ paddingLeft: `${level * 16 + 8}px` }}
                onClick={() => onNavigate(item.id)}
            >
                <span
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsOpen(!isOpen);
                    }}
                    className={cn("p-0.5 rounded hover:bg-muted text-muted-foreground", !hasChildren && "invisible")}
                >
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </span>

                {/* Icon/Dot */}
                <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: ENTITY_COLORS[item.entity.kind] }}
                />

                <span className="flex-1 truncate text-sm">{item.entity.label}</span>

                {/* Quick Add (on hover) */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                        e.stopPropagation();
                        // Determine sensible child type based on current type
                        const childKind = item.entity.kind === 'ARC' ? 'ACT' :
                            item.entity.kind === 'ACT' ? 'CHAPTER' :
                                item.entity.kind === 'CHAPTER' ? 'SCENE' :
                                    item.entity.kind === 'SCENE' ? 'BEAT' : null;
                        if (childKind) onQuickAdd(item.id, childKind);
                    }}
                >
                    <span className="text-xs">+</span>
                </Button>
            </div>

            {isOpen && hasChildren && (
                <div className="border-l border-border/30 ml-4">
                    {children.map(child => (
                        <TreeItem
                            key={child.item.id}
                            node={child}
                            onNavigate={onNavigate}
                            onQuickAdd={onQuickAdd}
                            level={level + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
