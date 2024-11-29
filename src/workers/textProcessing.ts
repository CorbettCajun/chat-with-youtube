import { analyzeContent } from '../utils/smartCorrection';
import { performance } from 'perf_hooks';

interface TextProcessingResult {
  analysis: ReturnType<typeof analyzeContent>;
  processingTime: number;
  wordCount: number;
  readingTime: number; // in minutes
  complexity: {
    score: number;
    level: 'basic' | 'intermediate' | 'advanced';
  };
}

export default async function processText(
  data: { text: string; metadata: any }
): Promise<TextProcessingResult> {
  const startTime = performance.now();

  // Perform content analysis
  const analysis = analyzeContent(data.text);

  // Calculate word count
  const wordCount = data.text.trim().split(/\s+/).length;

  // Calculate reading time (assuming 200 words per minute)
  const readingTime = wordCount / 200;

  // Calculate text complexity
  const complexityScore = calculateComplexity(data.text);

  const result: TextProcessingResult = {
    analysis,
    processingTime: performance.now() - startTime,
    wordCount,
    readingTime,
    complexity: {
      score: complexityScore,
      level: getComplexityLevel(complexityScore),
    },
  };

  return result;
}

function calculateComplexity(text: string): number {
  // Implement Automated Readability Index (ARI)
  const sentences = text.split(/[.!?]+/).filter(Boolean);
  const words = text.trim().split(/\s+/);
  const characters = text.replace(/\s/g, '').length;

  if (sentences.length === 0 || words.length === 0) {
    return 0;
  }

  const averageWordLength = characters / words.length;
  const averageSentenceLength = words.length / sentences.length;

  // ARI formula: 4.71 * (characters/words) + 0.5 * (words/sentences) - 21.43
  const ariScore = 4.71 * averageWordLength + 0.5 * averageSentenceLength - 21.43;

  // Normalize score to 0-100 range
  return Math.max(0, Math.min(100, (ariScore + 21.43) * 5));
}

function getComplexityLevel(score: number): 'basic' | 'intermediate' | 'advanced' {
  if (score < 40) return 'basic';
  if (score < 70) return 'intermediate';
  return 'advanced';
}
