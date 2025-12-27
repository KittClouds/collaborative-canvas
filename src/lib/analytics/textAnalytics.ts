// Text Analytics Service - Pure JavaScript text analysis engine

export interface SentenceLengthDistribution {
  '1': number;
  '2-6': number;
  '7-15': number;
  '16-25': number;
  '26-39': number;
  '40+': number;
}

export interface FlowInsights {
  consecutivePatterns: number; // Count of 3+ similar-length sentences in a row
  dominantRange: string; // Which category has the most sentences
  varietyScore: number; // 0-100, how evenly distributed
  hasMonotony: boolean; // True if 5+ consecutive similar sentences
}

export interface TextAnalytics {
  wordCount: number;
  characterCount: number;
  characterCountNoSpaces: number;
  sentenceCount: number;
  paragraphCount: number;
  readingLevel: string;
  readingTimeMinutes: number;
  readingTimeSeconds: number;
  speakingTimeMinutes: number;
  speakingTimeSeconds: number;
  averageSentenceLength: number;
  sentenceLengthVariation: number;
  flowScore: number;
  sentenceLengthDistribution: SentenceLengthDistribution;
  flowInsights: FlowInsights;
  keywordDensity: Array<{ word: string; count: number; percentage: number }>;
}

// Common English stop words to filter out
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he',
  'she', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your',
  'his', 'our', 'their', 'mine', 'yours', 'hers', 'ours', 'theirs',
  'what', 'which', 'who', 'whom', 'whose', 'where', 'when', 'why', 'how',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some',
  'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too',
  'very', 'just', 'also', 'now', 'here', 'there', 'then', 'once', 'if',
  'into', 'through', 'during', 'before', 'after', 'above', 'below', 'up',
  'down', 'out', 'off', 'over', 'under', 'again', 'further', 'any', 'about'
]);

/**
 * Parse TipTap JSON content to plain text
 */
export function parseContentToPlainText(content: string): string {
  if (!content) return '';

  try {
    const json = JSON.parse(content);
    return extractTextFromNode(json).trim();
  } catch {
    // If not JSON, return as-is (might be plain text)
    return content;
  }
}

function extractTextFromNode(node: any): string {
  if (!node) return '';

  // Text node
  if (node.text) {
    return node.text;
  }

  // Has children
  if (node.content && Array.isArray(node.content)) {
    const texts = node.content.map(extractTextFromNode);

    // Add appropriate spacing based on node type
    if (node.type === 'paragraph' || node.type === 'heading') {
      return texts.join('') + '\n\n';
    }
    if (node.type === 'listItem') {
      return texts.join('') + '\n';
    }

    return texts.join('');
  }

  return '';
}

/**
 * Count syllables in a word (approximate)
 */
function countSyllables(word: string): number {
  word = word.toLowerCase().trim();
  if (word.length <= 3) return 1;

  // Remove silent e at end
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  word = word.replace(/^y/, '');

  const matches = word.match(/[aeiouy]{1,2}/g);
  return matches ? Math.max(matches.length, 1) : 1;
}

/**
 * Split text into words
 */
function getWords(text: string): string[] {
  return text
    .replace(/[^\w\s'-]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 0);
}

/**
 * Split text into sentences
 */
function getSentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * Split text into paragraphs
 */
function getParagraphs(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
}

/**
 * Categorize sentences by word count
 */
function categorizeSentenceLengths(sentences: string[]): SentenceLengthDistribution {
  const distribution: SentenceLengthDistribution = {
    '1': 0,
    '2-6': 0,
    '7-15': 0,
    '16-25': 0,
    '26-39': 0,
    '40+': 0,
  };

  sentences.forEach(sentence => {
    const wordCount = getWords(sentence).length;

    if (wordCount === 1) distribution['1']++;
    else if (wordCount <= 6) distribution['2-6']++;
    else if (wordCount <= 15) distribution['7-15']++;
    else if (wordCount <= 25) distribution['16-25']++;
    else if (wordCount <= 39) distribution['26-39']++;
    else distribution['40+']++;
  });

  return distribution;
}

/**
 * Detect consecutive sentences of similar length
 */
function detectConsecutivePatterns(sentences: string[]): number {
  const lengths = sentences.map(s => getWords(s).length);
  let patternCount = 0;
  let consecutiveCount = 1;

  for (let i = 1; i < lengths.length; i++) {
    const diff = Math.abs(lengths[i] - lengths[i - 1]);

    // Consider "similar" if within 3 words
    if (diff <= 3) {
      consecutiveCount++;
      if (consecutiveCount >= 3) {
        patternCount++;
      }
    } else {
      consecutiveCount = 1;
    }
  }

  return patternCount;
}

/**
 * Calculate variety score (entropy-based)
 */
function calculateVarietyScore(distribution: SentenceLengthDistribution, totalSentences: number): number {
  if (totalSentences === 0) return 0;

  const values = Object.values(distribution);
  const probabilities = values.map(v => v / totalSentences).filter(p => p > 0);

  // Shannon entropy normalized to 0-100
  const entropy = -probabilities.reduce((sum, p) => sum + p * Math.log2(p), 0);
  const maxEntropy = Math.log2(probabilities.length);

  return Math.round((entropy / maxEntropy) * 100);
}

/**
 * Generate flow insights
 */
function analyzeFlowInsights(
  distribution: SentenceLengthDistribution,
  sentences: string[]
): FlowInsights {
  const consecutivePatterns = detectConsecutivePatterns(sentences);
  const totalSentences = Object.values(distribution).reduce((a, b) => a + b, 0);
  const varietyScore = calculateVarietyScore(distribution, totalSentences);

  // Find dominant range
  const entries = Object.entries(distribution) as [keyof SentenceLengthDistribution, number][];
  const dominant = entries.reduce((max, entry) =>
    entry[1] > max[1] ? entry : max
  );

  // Check for monotony (5+ consecutive similar sentences)
  const lengths = sentences.map(s => getWords(s).length);
  let maxConsecutive = 1;
  let currentConsecutive = 1;

  for (let i = 1; i < lengths.length; i++) {
    if (Math.abs(lengths[i] - lengths[i - 1]) <= 3) {
      currentConsecutive++;
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
    } else {
      currentConsecutive = 1;
    }
  }

  return {
    consecutivePatterns,
    dominantRange: dominant[0],
    varietyScore,
    hasMonotony: maxConsecutive >= 5,
  };
}

/**
 * Calculate Flesch-Kincaid Grade Level
 */
function calculateReadingLevel(
  wordCount: number,
  sentenceCount: number,
  syllableCount: number
): string {
  if (wordCount === 0 || sentenceCount === 0) return 'N/A';

  const avgWordsPerSentence = wordCount / sentenceCount;
  const avgSyllablesPerWord = syllableCount / wordCount;

  const grade = 0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59;

  if (grade < 1) return 'Kindergarten';
  if (grade < 6) return '1st-5th Grade';
  if (grade < 9) return '6th-8th Grade';
  if (grade < 13) return '9th-12th Grade';
  if (grade < 17) return 'College Level';
  return 'Graduate Level';
}

/**
 * Calculate standard deviation
 */
function calculateStandardDeviation(numbers: number[]): number {
  if (numbers.length === 0) return 0;

  const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
  const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / numbers.length;

  return Math.sqrt(variance);
}

/**
 * Calculate keyword density
 */
function calculateKeywordDensity(
  words: string[],
  totalWords: number
): Array<{ word: string; count: number; percentage: number }> {
  const frequencies: Record<string, number> = {};

  words.forEach(word => {
    const normalized = word.toLowerCase().replace(/[^a-z'-]/g, '');

    // Skip stop words, short words, and words with numbers
    if (
      normalized.length < 4 ||
      STOP_WORDS.has(normalized) ||
      /\d/.test(normalized)
    ) {
      return;
    }

    frequencies[normalized] = (frequencies[normalized] || 0) + 1;
  });

  // Sort by frequency and take top 100
  return Object.entries(frequencies)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 100)
    .map(([word, count]) => ({
      word,
      count,
      percentage: Math.round((count / totalWords) * 1000) / 10, // One decimal place
    }));
}

/**
 * Main analysis function
 */
export function analyzeText(text: string): TextAnalytics {
  const words = getWords(text);
  const sentences = getSentences(text);
  const paragraphs = getParagraphs(text);

  const wordCount = words.length;
  const characterCount = text.length;
  const characterCountNoSpaces = text.replace(/\s/g, '').length;
  const sentenceCount = sentences.length;
  const paragraphCount = paragraphs.length;

  // Calculate syllables for reading level
  const syllableCount = words.reduce((sum, word) => sum + countSyllables(word), 0);

  // Reading level
  const readingLevel = calculateReadingLevel(wordCount, sentenceCount, syllableCount);

  // Reading time (225 words per minute average)
  const readingTimeTotal = Math.ceil((wordCount / 225) * 60);
  const readingTimeMinutes = Math.floor(readingTimeTotal / 60);
  const readingTimeSeconds = readingTimeTotal % 60;

  // Speaking time (150 words per minute average)
  const speakingTimeTotal = Math.ceil((wordCount / 150) * 60);
  const speakingTimeMinutes = Math.floor(speakingTimeTotal / 60);
  const speakingTimeSeconds = speakingTimeTotal % 60;

  // Sentence length analysis
  const sentenceLengths = sentences.map(s => getWords(s).length);
  const averageSentenceLength = sentenceCount > 0
    ? Math.round((wordCount / sentenceCount) * 10) / 10
    : 0;
  const sentenceLengthVariation = calculateStandardDeviation(sentenceLengths);

  // Enhanced flow analysis
  const sentenceLengthDistribution = categorizeSentenceLengths(sentences);
  const flowInsights = analyzeFlowInsights(sentenceLengthDistribution, sentences);

  // Enhanced flow score: combine variation + variety
  const flowScore = Math.round(
    (Math.min(100, (sentenceLengthVariation / 8) * 100) * 0.6) +
    (flowInsights.varietyScore * 0.4)
  );

  // Keyword density
  const keywordDensity = calculateKeywordDensity(words, wordCount);

  return {
    wordCount,
    characterCount,
    characterCountNoSpaces,
    sentenceCount,
    paragraphCount,
    readingLevel,
    readingTimeMinutes,
    readingTimeSeconds,
    speakingTimeMinutes,
    speakingTimeSeconds,
    averageSentenceLength,
    sentenceLengthVariation,
    flowScore,
    sentenceLengthDistribution,
    flowInsights,
    keywordDensity,
  };
}
