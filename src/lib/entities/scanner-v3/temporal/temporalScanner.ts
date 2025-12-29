
import winkNLP from "wink-nlp";
import model from "wink-eng-lite-model";

const nlp = winkNLP(model);
const its = nlp.its;

// ---- Types ----

export type TemporalMentionKind =
  | "DATE"
  | "TIME"
  | "WEEKDAY"
  | "MONTH"
  | "RELATIVE"
  | "CHAPTER"
  | "SCENE"
  | "ACT"
  | "PART"
  | "EPISODE";

export type TemporalMention = {
  kind: TemporalMentionKind;
  text: string;
  start: number; // char offset
  end: number;   // char offset
  confidence: number;
  // Optional numeric payloads for narrative ordering:
  numberValue?: number; // chapter/scene/etc.
  weekdayIndex?: number; // 0=Mon ... 6=Sun
};

export type NarrativeCursor = {
  chapter?: number;
  scene?: number;
  act?: number;
  part?: number;
  episode?: number;

  // World-time state (optional; leave unresolved if not confident):
  absoluteISO?: string; // normalized ISO timestamp (if resolvable)
  // For relative expressions, keep structured intent:
  relative?: { direction: "before" | "after" | "later" | "earlier"; amount?: number; unit?: string };
};

export type TemporalScanResult = {
  mentions: TemporalMention[];
  cursorMutations: Array<{ at: number; patch: Partial<NarrativeCursor> }>; // at = doc offset (char)
};

// ---- Aho matcher contract (plug your existing engine here) ----

export type AhoHit = { key: string; start: number; end: number };
export interface AhoMatcher {
  find(text: string): AhoHit[];
}

// ---- Dictionary ----

const WEEKDAYS: Array<{ key: string; idx: number }> = [
  { key: "monday", idx: 0 },
  { key: "tuesday", idx: 1 },
  { key: "wednesday", idx: 2 },
  { key: "thursday", idx: 3 },
  { key: "friday", idx: 4 },
  { key: "saturday", idx: 5 },
  { key: "sunday", idx: 6 },
];

const RELATIVE_KEYS = [
  "later that day",
  "later that night",
  "the next day",
  "the previous day",
  "next morning",
  "next night",
  "that morning",
  "that night",
  "meanwhile",
];

// NOTE: numeric extraction is handled with a tiny fast parser on the matched span.
const NARRATIVE_KEYS = [
  "chapter",
  "ch.",
  "scene",
  "act",
  "part",
  "episode",
];

// ---- Helpers ----

function normalizeForAho(s: string) {
  // Keep this aligned with whatever the scanner already does
  // (lowercase + collapse whitespace is usually enough).
  return s.toLowerCase().replace(/\s+/g, " ");
}

function parseTrailingInteger(original: string, endIdx: number): number | undefined {
  // Read forward from endIdx in original to capture "Chapter 12" etc.
  // Expecting: whitespace then digits.
  let i = endIdx;
  while (i < original.length && /\s/.test(original[i])) i++;
  let j = i;
  while (j < original.length && /[0-9]/.test(original[j])) j++;
  if (j > i) return Number(original.slice(i, j));
  return undefined;
}

function kindFromNarrativeKey(k: string): TemporalMentionKind | null {
  const key = k.toLowerCase();
  if (key === "chapter" || key === "ch.") return "CHAPTER";
  if (key === "scene") return "SCENE";
  if (key === "act") return "ACT";
  if (key === "part") return "PART";
  if (key === "episode") return "EPISODE";
  return null;
}

// ---- Core ----

export function scanTemporal(
  inputText: string,
  aho: AhoMatcher,
): TemporalScanResult {
  const mentions: TemporalMention[] = [];
  const cursorMutations: TemporalScanResult["cursorMutations"] = [];

  // 1) Aho pass for narrative + relative + weekday anchors
  const normalized = normalizeForAho(inputText);
  const hits = aho.find(normalized);

  for (const h of hits) {
    const key = h.key.toLowerCase();
    const raw = inputText.slice(h.start, h.end);

    // Weekdays
    const wd = WEEKDAYS.find((w) => w.key === key);
    if (wd) {
      mentions.push({
        kind: "WEEKDAY",
        text: raw,
        start: h.start,
        end: h.end,
        confidence: 0.85,
        weekdayIndex: wd.idx,
      });
      cursorMutations.push({ at: h.start, patch: {} }); // optional: set weekday on cursor if you store it
      continue;
    }

    // Relative phrases
    if (RELATIVE_KEYS.includes(key)) {
      mentions.push({
        kind: "RELATIVE",
        text: raw,
        start: h.start,
        end: h.end,
        confidence: 0.7,
      });
      cursorMutations.push({
        at: h.start,
        patch: { relative: { direction: "later" } },
      });
      continue;
    }

    // Narrative markers (Chapter/Scene/etc.)
    if (NARRATIVE_KEYS.includes(key)) {
      const kind = kindFromNarrativeKey(key);
      if (!kind) continue;

      const n = parseTrailingInteger(inputText, h.end);
      mentions.push({
        kind,
        text: n ? `${raw}${inputText.slice(h.end, h.end + String(n).length + 1)}` : raw,
        start: h.start,
        end: n ? Math.min(inputText.length, h.end + 1 + String(n).length) : h.end,
        confidence: 0.95,
        numberValue: n,
      });

      // Mutate narrative cursor (ordering axis), even without dates.
      if (kind === "CHAPTER" && n != null) cursorMutations.push({ at: h.start, patch: { chapter: n } });
      if (kind === "SCENE" && n != null) cursorMutations.push({ at: h.start, patch: { scene: n } });
      if (kind === "ACT" && n != null) cursorMutations.push({ at: h.start, patch: { act: n } });
      if (kind === "PART" && n != null) cursorMutations.push({ at: h.start, patch: { part: n } });
      if (kind === "EPISODE" && n != null) cursorMutations.push({ at: h.start, patch: { episode: n } });

      continue;
    }
  }

  // 2) wink pass for DATE/TIME spans (world-time axis)
  const doc = nlp.readDoc(inputText);
  const ents = doc.entities();

  ents.each((e) => {
    const t = e.out(its.type);
    if (t !== "DATE" && t !== "TIME") return;

    // wink provides token spans; char offsets are approximated by locating the entity text.
    // If you already have a token->offset map in the scanner, plug it in here instead.
    const text = e.out();
    const start = inputText.indexOf(text);
    if (start < 0) return;

    mentions.push({
      kind: t,
      text,
      start,
      end: start + text.length,
      confidence: 0.8,
    });

    // Optional normalization: if Date() parses, store ISO on cursor mutation.
    const d = new Date(text);
    if (!Number.isNaN(d.getTime())) {
      cursorMutations.push({ at: start, patch: { absoluteISO: d.toISOString() } });
    }
  });

  // 3) Sort + dedupe overlaps (keep highest confidence)
  mentions.sort((a, b) => a.start - b.start || b.confidence - a.confidence);

  const deduped: TemporalMention[] = [];
  for (const m of mentions) {
    const prev = deduped[deduped.length - 1];
    if (!prev) {
      deduped.push(m);
      continue;
    }
    const overlaps = m.start < prev.end && m.end > prev.start;
    if (!overlaps) {
      deduped.push(m);
      continue;
    }
    if (m.confidence > prev.confidence) deduped[deduped.length - 1] = m;
  }

  cursorMutations.sort((a, b) => a.at - b.at);

  return { mentions: deduped, cursorMutations };
}
