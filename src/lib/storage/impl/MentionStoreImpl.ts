// Removed: UnifiedGraph imports
import type {
  IMentionStore,
  Mention,
  CreateMentionInput,
} from '../interfaces';

export class MentionStoreImpl implements IMentionStore {
  constructor() {
    // this.graph = getGraph();
  }

  async createMention(input: CreateMentionInput): Promise<Mention> {
    return {} as any;
  }

  async getMentionById(id: string): Promise<Mention | null> {
    return null;
  }

  async getMentionsByNoteId(noteId: string): Promise<Mention[]> {
    return [];
  }

  async getMentionsByEntityId(entityId: string): Promise<Mention[]> {
    return [];
  }

  async updateMentionStatus(
    id: string,
    status: 'pending' | 'accepted' | 'rejected',
    resolvedEntityId?: string
  ): Promise<void> { }

  async deleteMention(id: string): Promise<void> { }
}

let mentionStoreInstance: MentionStoreImpl | null = null;

export function getMentionStoreImpl(): MentionStoreImpl {
  if (!mentionStoreInstance) {
    mentionStoreInstance = new MentionStoreImpl();
  }
  return mentionStoreInstance;
}

export function resetMentionStore(): void {
  mentionStoreInstance = null;
}
