import { cozoDb } from '@/lib/cozo/db';
import { generateId } from '@/lib/utils/ids';
import type { EntityTypeOverride } from './types';

const OVERRIDE_SCHEMA = `
:create entity_type_override {
    id: Uuid,
    normalized_text: String,
    entity_type: String,
    entity_subtype: String? default null,
    created_at: Float default now(),
    updated_at: Float default now(),
    note_context: String? default null
}
`;

export class UserCorrectionStore {
  private cache: Map<string, EntityTypeOverride> = new Map();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      cozoDb.runQuery(OVERRIDE_SCHEMA);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes('already exists')) {
        console.error('[UserCorrectionStore] Schema creation failed:', e);
      }
    }

    await this.loadAll();
    this.initialized = true;
    console.log(`[UserCorrectionStore] Initialized with ${this.cache.size} overrides`);
  }

  private async loadAll(): Promise<void> {
    try {
      const result = cozoDb.runQuery(`
        ?[id, normalized_text, entity_type, entity_subtype, created_at, updated_at, note_context] :=
        *entity_type_override{id, normalized_text, entity_type, entity_subtype, created_at, updated_at, note_context}
      `);

      if (result.rows) {
        for (const row of result.rows) {
          const override: EntityTypeOverride = {
            id: row[0] as string,
            normalizedText: row[1] as string,
            entityType: row[2] as string,
            entitySubtype: (row[3] as string) || undefined,
            createdAt: row[4] as number,
            updatedAt: row[5] as number,
            noteContext: (row[6] as string) || undefined,
          };
          const cacheKey = override.noteContext
            ? `${override.normalizedText}:${override.noteContext}`
            : override.normalizedText;
          this.cache.set(cacheKey, override);
        }
      }
    } catch (err) {
      console.error('[UserCorrectionStore] Failed to load overrides:', err);
    }
  }

  getOverride(text: string, noteContext?: string): EntityTypeOverride | undefined {
    const normalized = text.toLowerCase().trim();

    if (noteContext) {
      const noteSpecific = this.cache.get(`${normalized}:${noteContext}`);
      if (noteSpecific) return noteSpecific;
    }

    return this.cache.get(normalized);
  }

  hasOverride(text: string): boolean {
    return this.cache.has(text.toLowerCase().trim());
  }

  setOverride(
    text: string,
    entityType: string,
    entitySubtype?: string,
    noteContext?: string
  ): EntityTypeOverride {
    const normalized = text.toLowerCase().trim();
    const cacheKey = noteContext ? `${normalized}:${noteContext}` : normalized;
    const now = Date.now();

    const existing = this.cache.get(cacheKey);
    const override: EntityTypeOverride = {
      id: existing?.id || generateId(),
      normalizedText: normalized,
      entityType,
      entitySubtype,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      noteContext,
    };

    try {
      cozoDb.runQuery(
        `
        ?[id, normalized_text, entity_type, entity_subtype, created_at, updated_at, note_context] <- 
        [[$id, $normalized_text, $entity_type, $entity_subtype, $created_at, $updated_at, $note_context]]
        :put entity_type_override {
          id, normalized_text, entity_type, entity_subtype, created_at, updated_at, note_context
        }
      `,
        {
          id: override.id,
          normalized_text: override.normalizedText,
          entity_type: override.entityType,
          entity_subtype: override.entitySubtype || null,
          created_at: override.createdAt,
          updated_at: override.updatedAt,
          note_context: override.noteContext || null,
        }
      );
    } catch (err) {
      console.error('[UserCorrectionStore] Failed to persist override:', err);
    }

    this.cache.set(cacheKey, override);
    return override;
  }

  removeOverride(text: string, noteContext?: string): boolean {
    const normalized = text.toLowerCase().trim();
    const cacheKey = noteContext ? `${normalized}:${noteContext}` : normalized;

    const existing = this.cache.get(cacheKey);
    if (!existing) return false;

    try {
      cozoDb.runQuery(
        `
        ?[id] <- [[$id]]
        :rm entity_type_override { id }
      `,
        { id: existing.id }
      );
    } catch (err) {
      console.error('[UserCorrectionStore] Failed to remove override:', err);
      return false;
    }

    this.cache.delete(cacheKey);
    return true;
  }

  getAllOverrides(): EntityTypeOverride[] {
    return Array.from(this.cache.values());
  }

  getOverridesForNote(noteId: string): EntityTypeOverride[] {
    return Array.from(this.cache.values()).filter(o => o.noteContext === noteId);
  }

  clearAllOverrides(): void {
    try {
      cozoDb.runQuery(`
        ?[id] := *entity_type_override{id}
        :rm entity_type_override { id }
      `);
    } catch (err) {
      console.error('[UserCorrectionStore] Failed to clear overrides:', err);
    }
    this.cache.clear();
  }
}

export const userCorrectionStore = new UserCorrectionStore();
