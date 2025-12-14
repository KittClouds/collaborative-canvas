// Text Analytics Service - Pure JavaScript text analysis engine

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
  
  // Sort by frequency and take top 15
  return Object.entries(frequencies)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
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
  
  // Flow score (normalized 0-100, higher variation = better flow)
  // A variation of 5-8 words is considered good writing
  const flowScore = Math.min(100, Math.round((sentenceLengthVariation / 8) * 100));
  
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
    keywordDensity,
  };
}
