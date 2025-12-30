
import { useCallback, useMemo } from 'react';
import { useJotaiNotes } from './useJotaiNotes';
import { useCalendarContext } from '@/contexts/CalendarContext';
import { NARRATIVE_FOLDER_SCHEMA } from '@/lib/folders/schemas/narrative';
import { Folder } from '@/types/noteTypes';

export interface NarrativeOption {
    type: 'folder' | 'note';
    label: string;
    entityKind: string;
    subtype?: string;
    icon?: string;
}

export interface NarrativeRoot {
    id: string;
    name: string;
}

export function useNarrativeManagement() {
    const { createNote, createFolder, folderTree, updateNoteContent: updateContent } = useJotaiNotes();

    // 1. Identify Narrative Roots
    const narrativeRoots = useMemo(() => {
        const roots: NarrativeRoot[] = [];
        // Look at top-level folders (or depth 1)
        if (!folderTree) return [];

        // Helper to find NARRATIVE folders
        // We assume they are strictly top-level or high-level
        // We iterate the tree.
        const findRoots = (nodes: Folder[]) => {
            for (const node of nodes) {
                // Check if this node matches NARRATIVE kind
                // Note: implementation details of 'entityKind' property location might vary (node.data vs node)
                // Based on previous file reads, it seemed to be on the node object itself or file property
                const kind = (node as any).entityKind || (node as any).entity_kind || (node as any).file?.entityKind;

                if (kind === 'NARRATIVE') {
                    roots.push({ id: node.id, name: node.name });
                }

                // If we want to support nested narrative roots (unlikely for now), recurse?
                // For safety, let's only check top level for now to avoid massive traversal if not needed.
                // Or maybe check one level deep.
            }
        };

        findRoots(folderTree as Folder[]);
        return roots;
    }, [folderTree]);


    // 2. Get Available Types (Schema Aware)
    const getAvailableTypes = useCallback((): NarrativeOption[] => {
        const options: NarrativeOption[] = [];

        NARRATIVE_FOLDER_SCHEMA.allowedSubfolders?.forEach(sub => {
            options.push({
                type: 'folder',
                label: `Add ${sub.label}`,
                entityKind: sub.entityKind || 'UNKNOWN',
                subtype: sub.subtype,
                icon: sub.icon
            });
        });

        NARRATIVE_FOLDER_SCHEMA.allowedNoteTypes?.forEach(note => {
            options.push({
                type: 'note',
                label: note.label,
                entityKind: note.entityKind || 'UNKNOWN',
                icon: note.icon
            });
        });

        return options;
    }, []);

    // 3. Create Narrative Root
    const createNarrativeRoot = useCallback(async (name: string) => {
        const folder = await createFolder(name, undefined, { // undefined parent = root
            entityKind: 'NARRATIVE'
        });
        return folder;
    }, [createFolder]);

    // 4. Create Node strictly inside a Root
    const createNarrativeNode = useCallback(async (
        rootId: string,
        title: string,
        option: NarrativeOption,
        date: { year: number, month: number, day: number }
    ) => {
        // A. Verify Root Existence (Safety)
        // We assume rootId is valid since passed from UI selection

        // B. Determine Destination Container (Strict Nesting)
        // We must find the correct subfolder *inside* this rootId.

        let parentId = rootId; // Default to root if no container found/needed

        // Helper to find container inside specific branch
        const findContainerInBranch = (nodes: any[], targetKind: string, targetName: string): string | undefined => {
            for (const node of nodes) {
                const kind = node.entityKind || node.file?.entityKind;
                if (kind === targetKind || node.name === targetName) {
                    return node.id;
                }
                // Don't recurse too deep, containers should be immediate children of root or close
                // But for robustnes...
                if (node.children) {
                    const found = findContainerInBranch(node.children, targetKind, targetName);
                    if (found) return found;
                }
            }
            return undefined;
        };

        // Find the root node object in tree to search its children
        const findNode = (id: string, nodes: any[]): any | undefined => {
            for (const node of nodes) {
                if (node.id === id) return node;
                if (node.children) {
                    const found = findNode(id, node.children);
                    if (found) return found;
                }
            }
            return undefined;
        };

        const rootNode = findNode(rootId, folderTree as any[]);

        if (rootNode && rootNode.children) {
            // Map EntityKind to Container Name/Kind
            const containerMap: Record<string, string> = {
                'CHARACTER': 'Characters',
                'SCENE': 'Scenes',
                'CHAPTER': 'Chapters',
                'ACT': 'Acts',
                'EVENT': 'Events'
            };
            const targetName = containerMap[option.entityKind];

            if (targetName) {
                // Try to find existing container
                const existing = findContainerInBranch(rootNode.children, 'FOLDER', targetName); // Usually container is just FOLDER kind but named specifically? 
                // Or maybe container has kind? 
                // Let's search by name primarily for V1
                if (existing) {
                    parentId = existing;
                } else {
                    // Create Container if missing!
                    const newContainer = await createFolder(targetName, rootId, {
                        entityKind: option.entityKind // Label the container with the kind it holds? Or generic? 
                        // Actually NARRATIVE schema says 'allowedSubfolders' define the container properties.
                        // The 'Characters' folder should be created.
                    });
                    // We might want to tag it?
                    // For now simplest is name.
                    parentId = newContainer.id;
                }
            }
        }

        // C. Create the Entity
        const frontmatter = `---
type: ${option.entityKind}
title: ${title}
fantasy_date:
  year: ${date.year}
  month: ${date.month}
  day: ${date.day}
---

# ${title}

`;

        let entityId: string;

        if (option.type === 'folder') {
            const folder = await createFolder(title, parentId, {
                entityKind: option.entityKind,
                entitySubtype: option.subtype,
                fantasy_date: date
            });
            entityId = folder.id;
        } else {
            const note = await createNote(parentId, title);
            // Safety: ensure updateContent is available
            if (updateContent) {
                await updateContent(note.id, frontmatter);
            }
            entityId = note.id;
        }

        return { id: entityId, kind: option.entityKind };

    }, [createFolder, createNote, updateContent, folderTree]);

    return {
        narrativeRoots,
        createNarrativeRoot,
        createNarrativeNode,
        getAvailableTypes
    };
}
