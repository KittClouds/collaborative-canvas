/**
 * Obsidian Scope Configuration
 * Defines the scope for standard note-linking-note graphs.
 */

export type ObsidianTarget = 'global' | 'folder';

export interface ObsidianScope {
    type: 'obsidian';
    target: ObsidianTarget;

    // If target is 'folder', this is required
    folderId?: string;

    // Optional filters
    includeTags?: string[];
    excludeTags?: string[];
}
