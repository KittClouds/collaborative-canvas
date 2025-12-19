import { generateId } from '@/lib/utils/ids';
import type { ExtractionResult, ExtractionSource } from './types';

const EXTRACTOR_VERSIONS: Record<ExtractionSource, string> = {
  regex: '1.0.0',
  ner: '1.0.0',
  llm: '1.0.0',
  title: '1.0.0',
  wikilink: '1.0.0',
  blueprint: '1.0.0',
  manual: '1.0.0',
};

const NER_TYPE_MAP: Record<string, string> = {
  person: 'CHARACTER',
  per: 'CHARACTER',
  location: 'LOCATION',
  loc: 'LOCATION',
  organization: 'FACTION',
  org: 'FACTION',
  event: 'EVENT',
  artifact: 'ITEM',
  misc: 'CONCEPT',
  product: 'ITEM',
  work_of_art: 'ITEM',
  group: 'FACTION',
  building: 'LOCATION',
  landmark: 'LOCATION',
  object: 'ITEM',
  concept: 'CONCEPT',
  creature: 'NPC',
};

export class ResultNormalizer {
  normalizeNERResults(
    nerEntities: Array<{
      word?: string;
      text?: string;
      entity_type?: string;
      nerLabel?: string;
      score?: number;
      confidence?: number;
      start: number;
      end: number;
    }>,
    noteId: string,
    noteTitle: string,
    fullText: string
  ): ExtractionResult[] {
    return nerEntities.map(entity => {
      const text = entity.word || entity.text || '';
      const nerType = entity.entity_type || entity.nerLabel || 'MISC';
      const entityType = this.mapNERTypeToEntityKind(nerType);
      const confidence = entity.score ?? entity.confidence ?? 0.5;

      return {
        extractionId: generateId(),
        text,
        normalizedText: text.toLowerCase().trim(),
        entityType,
        confidence,
        source: 'ner' as ExtractionSource,
        extractorVersion: EXTRACTOR_VERSIONS.ner,
        context: {
          sentence: this.extractSentence(fullText, entity.start, entity.end),
          offset: entity.start,
          noteId,
          noteTitle,
        },
        timestamp: Date.now(),
        rawOutput: entity,
      };
    });
  }

  normalizeRegexResults(
    matches: Array<{
      kind: string;
      subtype?: string;
      label: string;
      charPosition: number;
      context: string;
    }>,
    noteId: string,
    noteTitle: string
  ): ExtractionResult[] {
    return matches.map(match => ({
      extractionId: generateId(),
      text: match.label,
      normalizedText: match.label.toLowerCase().trim(),
      entityType: match.kind,
      entitySubtype: match.subtype,
      confidence: 1.0,
      source: 'regex' as ExtractionSource,
      extractorVersion: EXTRACTOR_VERSIONS.regex,
      context: {
        sentence: match.context,
        offset: match.charPosition,
        noteId,
        noteTitle,
      },
      timestamp: Date.now(),
    }));
  }

  normalizeLLMResults(
    llmEntities: Array<{
      name: string;
      type: string;
      subtype?: string;
      confidence?: number;
      summary?: string;
    }>,
    noteId: string,
    noteTitle: string,
    fullText: string
  ): ExtractionResult[] {
    return llmEntities.map(entity => {
      const offset = fullText.toLowerCase().indexOf(entity.name.toLowerCase());

      return {
        extractionId: generateId(),
        text: entity.name,
        normalizedText: entity.name.toLowerCase().trim(),
        entityType: entity.type,
        entitySubtype: entity.subtype,
        confidence: entity.confidence ?? 0.8,
        source: 'llm' as ExtractionSource,
        extractorVersion: EXTRACTOR_VERSIONS.llm,
        context: {
          sentence:
            offset >= 0
              ? this.extractSentence(fullText, offset, offset + entity.name.length)
              : '',
          offset: offset >= 0 ? offset : 0,
          noteId,
          noteTitle,
        },
        timestamp: Date.now(),
        rawOutput: entity,
      };
    });
  }

  normalizeTitleResult(
    parsed: { kind: string; subtype?: string; label?: string },
    noteId: string,
    noteTitle: string
  ): ExtractionResult | null {
    if (!parsed.label) return null;

    return {
      extractionId: generateId(),
      text: parsed.label,
      normalizedText: parsed.label.toLowerCase().trim(),
      entityType: parsed.kind,
      entitySubtype: parsed.subtype,
      confidence: 1.0,
      source: 'title' as ExtractionSource,
      extractorVersion: EXTRACTOR_VERSIONS.title,
      context: {
        sentence: noteTitle,
        offset: 0,
        noteId,
        noteTitle,
      },
      timestamp: Date.now(),
    };
  }

  normalizeWikilinkResults(
    wikilinks: Array<{ target: string; displayText?: string; position: number }>,
    noteId: string,
    noteTitle: string
  ): ExtractionResult[] {
    return wikilinks.map(link => ({
      extractionId: generateId(),
      text: link.displayText || link.target,
      normalizedText: (link.displayText || link.target).toLowerCase().trim(),
      entityType: 'CONCEPT',
      confidence: 0.7,
      source: 'wikilink' as ExtractionSource,
      extractorVersion: EXTRACTOR_VERSIONS.wikilink,
      context: {
        sentence: '',
        offset: link.position,
        noteId,
        noteTitle,
      },
      timestamp: Date.now(),
    }));
  }

  normalizeBlueprintResult(
    entityType: string,
    entitySubtype: string | undefined,
    label: string,
    noteId: string,
    noteTitle: string
  ): ExtractionResult {
    return {
      extractionId: generateId(),
      text: label,
      normalizedText: label.toLowerCase().trim(),
      entityType,
      entitySubtype,
      confidence: 1.0,
      source: 'blueprint' as ExtractionSource,
      extractorVersion: EXTRACTOR_VERSIONS.blueprint,
      context: {
        sentence: noteTitle,
        offset: 0,
        noteId,
        noteTitle,
      },
      timestamp: Date.now(),
    };
  }

  normalizeManualResult(
    text: string,
    entityType: string,
    entitySubtype: string | undefined,
    noteId: string,
    noteTitle: string
  ): ExtractionResult {
    return {
      extractionId: generateId(),
      text,
      normalizedText: text.toLowerCase().trim(),
      entityType,
      entitySubtype,
      confidence: 1.0,
      source: 'manual' as ExtractionSource,
      extractorVersion: EXTRACTOR_VERSIONS.manual,
      context: {
        sentence: '',
        offset: 0,
        noteId,
        noteTitle,
      },
      timestamp: Date.now(),
    };
  }

  private mapNERTypeToEntityKind(nerType: string): string {
    const normalized = nerType.toLowerCase();
    return NER_TYPE_MAP[normalized] || 'CONCEPT';
  }

  private extractSentence(text: string, start: number, end: number): string {
    const sentenceStart = Math.max(
      0,
      text.lastIndexOf('.', start) + 1,
      text.lastIndexOf('!', start) + 1,
      text.lastIndexOf('?', start) + 1
    );

    let sentenceEnd = text.length;
    const nextPeriod = text.indexOf('.', end);
    const nextExclaim = text.indexOf('!', end);
    const nextQuestion = text.indexOf('?', end);

    if (nextPeriod >= 0) sentenceEnd = Math.min(sentenceEnd, nextPeriod + 1);
    if (nextExclaim >= 0) sentenceEnd = Math.min(sentenceEnd, nextExclaim + 1);
    if (nextQuestion >= 0) sentenceEnd = Math.min(sentenceEnd, nextQuestion + 1);

    return text.slice(sentenceStart, sentenceEnd).trim();
  }
}

export const resultNormalizer = new ResultNormalizer();
