import { cozoDb } from '../db';
import { parseDocumentIntoEpisodes } from './episodeParser';
import { extractEntitiesFromText } from './regexExtractor';
import { extractEntitiesWithLLM } from './llmExtractor';
import { findOrCreateEntity } from './entityMerger';
import type { JSONContent } from '@tiptap/react';
import type { ExtractionEpisode } from '../types';


export interface BatchProcessOptions {
    scope: 'note' | 'folder' | 'vault';
    scopeId: string;
    enableLLM: boolean;
    llmConfig?: any;
    granularity: 'block' | 'paragraph' | 'sentence';
    onProgress?: (progress: number, step: string) => void;
}

/**
 * Process a single note: episodes → entities → mentions
 */
export async function processNote(
    noteId: string,
    content: JSONContent,
    options: BatchProcessOptions
): Promise<void> {
    const groupId = `${options.scope}:${options.scopeId}`;

    options.onProgress?.(0, 'Parsing episodes');

    // Step 1: Create episodes
    const episodes = parseDocumentIntoEpisodes(content, {
        noteId,
        groupId,
        scopeType: options.scope,
        granularity: options.granularity,
    });

    // Insert episodes into CozoDB
    await insertEpisodes(episodes);

    options.onProgress?.(30, 'Extracting entities (regex)');

    // Step 2: Tier 1 extraction (always runs)
    for (const episode of episodes) {
        const { entities, mentions } = extractEntitiesFromText(
            episode.contentText,
            episode.id,
            groupId,
            options.scope
        );

        // Merge entities and insert mentions
        for (const entity of entities) {
            const entityId = await findOrCreateEntity(entity, groupId);

            // Update mentions with resolved entity ID
            for (const mention of mentions.filter(m => m.entityId === entity.id)) {
                mention.entityId = entityId;
            }
        }

        await insertMentions(mentions);
    }

    options.onProgress?.(60, 'Regex extraction complete');

    // Step 3: Tier 2 extraction (optional)
    if (options.enableLLM && options.llmConfig) {
        options.onProgress?.(70, 'LLM deep analysis');

        for (const episode of episodes) {
            try {
                const llmResult = await extractEntitiesWithLLM(
                    episode.contentText,
                    episode.id,
                    groupId,
                    options.scope,
                    options.llmConfig
                );

                // Merge LLM entities
                for (const entity of llmResult.entities) {
                    await findOrCreateEntity(entity, groupId);
                }

                // Insert LLM relationships
                await insertEdges(llmResult.relationships);

                // Update episode processing status
                // @ts-ignore
                await cozoDb.run(`
          ?[id, extraction_method, processed_at] := 
            id = $id,
            extraction_method = "llm_complete",
            processed_at = now()
          
          :update episode { id, extraction_method, processed_at }
        `, { id: episode.id });

            } catch (error) {
                console.error(`LLM extraction failed for episode ${episode.id}:`, error);
            }
        }
    }

    options.onProgress?.(100, 'Processing complete');

    // Update scope processing state
    await updateProcessingState(options.scope, options.scopeId, 'completed');
}

/**
 * Process entire folder (all notes)
 */
export async function processFolder(
    folderId: string,
    notes: Array<{ id: string; title: string; contentJson: JSONContent }>,
    options: Omit<BatchProcessOptions, 'scopeId'>
): Promise<void> {
    const totalNotes = notes.length;

    for (let i = 0; i < totalNotes; i++) {
        const { id: noteId, title, contentJson } = notes[i];

        options.onProgress?.(
            (i / totalNotes) * 100,
            `Processing note ${i + 1}/${totalNotes}: ${title}`
        );

        await processNote(noteId, contentJson, {
            ...options,
            scope: 'folder',
            scopeId: folderId,
        });
    }
}


/**
 * Process entire vault (all notes)
 */
export async function processVault(
    notes: Array<{ id: string; title: string; contentJson: JSONContent }>,
    options: Omit<BatchProcessOptions, 'scope' | 'scopeId'>
): Promise<void> {
    const totalNotes = notes.length;

    for (let i = 0; i < totalNotes; i++) {
        const { id: noteId, title, contentJson } = notes[i];

        options.onProgress?.(
            (i / totalNotes) * 100,
            `Processing note ${i + 1}/${totalNotes}: ${title}`
        );

        await processNote(noteId, contentJson, {
            ...options,
            scope: 'vault',
            scopeId: 'global',
        });
    }
}


// Helper functions for database operations

async function insertEpisodes(episodes: ExtractionEpisode[]): Promise<void> {

    // Bulk insert using CozoDB batch syntax
    // Removed content_text and content_json as they are no longer in the schema
    // @ts-ignore
    await cozoDb.run(`
    ?[
      id, note_id, created_at, valid_at,
      block_id, group_id, scope_type, extraction_method, sentence_index,
      paragraph_index
    ] <- $episodes
    
    :put episode {
      id, note_id, created_at, valid_at,
      block_id, group_id, scope_type, extraction_method, sentence_index,
      paragraph_index
    }
  `, {
        episodes: episodes.map(e => [
            e.id, e.noteId, e.createdAt.getTime(), e.validAt.getTime(),
            e.blockId, e.groupId, e.scopeType, e.extractionMethod, e.sentenceIndex,
            e.paragraphIndex
        ])
    });
}


async function insertMentions(mentions: any[]): Promise<void> {
    // @ts-ignore
    await cozoDb.run(`
    ?[id, episode_id, entity_id, context, char_position, confidence, extraction_method, created_at]
      <- $mentions
    
    :put mentions {
      id, episode_id, entity_id, context, char_position, confidence,
      extraction_method, created_at
    }
  `, {
        mentions: mentions.map(m => [
            m.id, m.episodeId, m.entityId, m.context, m.charPosition, m.confidence,
            m.extractionMethod, m.createdAt.getTime()
        ])
    });
}

async function insertEdges(edges: any[]): Promise<void> {
    // @ts-ignore
    await cozoDb.run(`
    ?[
      id, source_id, target_id, created_at, valid_at, group_id, scope_type,
      edge_type, fact, episode_ids, note_ids, weight, confidence, extraction_methods
    ] <- $edges
    
    :put entity_edge {
      id, source_id, target_id, created_at, valid_at, group_id, scope_type,
      edge_type, fact, episode_ids, note_ids, weight, confidence, extraction_methods
    }
  `, {
        edges: edges.map(e => [
            e.id, e.sourceId, e.targetId, e.createdAt.getTime(), e.validAt.getTime(), e.groupId, e.scopeType,
            e.edgeType, e.fact, e.episodeIds, e.noteIds, e.weight, e.confidence, e.extractionMethods
        ])
    });
}

async function updateProcessingState(
    scope: string,
    scopeId: string,
    status: string
): Promise<void> {
    // @ts-ignore
    await cozoDb.run(`
    ?[scope_type, scope_id, group_id, last_processed_at, status] := 
      scope_type = $scope,
      scope_id = $scope_id,
      group_id = concat($scope, ":", $scope_id),
      last_processed_at = now(),
      status = $status
    
    :put scope_processing_state {
      scope_type, scope_id, group_id, last_processed_at, status
    }
  `, { scope, scope_id: scopeId, status });
}
