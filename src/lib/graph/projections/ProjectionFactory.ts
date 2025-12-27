import { ObsidianProjection } from './obsidian/ObsidianProjection';
import { FolderGraphProjection } from './obsidian/FolderGraphProjection';
import { WikilinkProjection } from './obsidian/WikilinkProjection';
import { GlobalEntityProjection } from './entity/GlobalEntityProjection';
import { NoteEntityProjection } from './entity/NoteEntityProjection';
import { NoteConceptProjection } from './concept/NoteConceptProjection';
import { ProjectionScope } from './types';
import { BaseProjection } from './BaseProjection';
import { CozoDbService } from '@/lib/cozo/db';

export class ProjectionFactory {
    static create(db: CozoDbService, scope: ProjectionScope): BaseProjection<any> {
        switch (scope.type) {
            case 'obsidian':
                if (scope.target === 'global') {
                    return new ObsidianProjection(db, scope);
                } else if (scope.target === 'folder') {
                    return new FolderGraphProjection(db, scope);
                }
                // Fallback for note specific backlink graph if we added it to scope
                // or if we use a different factory method
                break;

            case 'entity':
                if (scope.target === 'global') {
                    return new GlobalEntityProjection(db, scope);
                } else if (scope.target === 'note') {
                    return new NoteEntityProjection(db, scope);
                }
                break;

            case 'concept':
                if (scope.target === 'note') {
                    return new NoteConceptProjection(db, scope);
                }
                break;
        }

        throw new Error(`Unsupported projection scope: ${scope.type} / ${scope.target}`);
    }

    static createWikilink(db: CozoDbService, noteId: string): WikilinkProjection {
        return new WikilinkProjection(db, noteId);
    }
}
