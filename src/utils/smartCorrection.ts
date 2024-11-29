import OpenAI from 'openai';
import NodeCache from 'node-cache';
import { distance } from 'fastest-levenshtein';
import scientificTerms from './dictionaries/scientific.json';
import technicalTerms from './dictionaries/technical.json';
import youtubeTerms from './dictionaries/social/youtube.json';
import twitterTerms from './dictionaries/social/twitter.json';
import tiktokTerms from './dictionaries/social/tiktok.json';
import instagramTerms from './dictionaries/social/instagram.json';
import contentTypes from './dictionaries/social/content_types.json';
import contentFormats from './dictionaries/social/content_formats.json';

// Initialize cache with 24-hour TTL
const correctionCache = new NodeCache({ stdTTL: 86400 });

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface CorrectionResult {
  original: string;
  corrected: string;
  confidence: number;
  source: 'dictionary' | 'ai' | 'none';
}

interface ContentAnalysis {
  platform: 'youtube' | 'twitter' | 'tiktok' | 'instagram' | 'general';
  contentType: 'tutorial' | 'documentary' | 'podcast' | 'music' | 'educational' | 'entertainment' | 'news_commentary' | 'gaming' | 'tech' | 'lifestyle' | 'other';
  format: 'promotional' | 'educational' | 'short_form' | 'long_form' | 'interactive' | 'user_generated' | 'behind_scenes' | 'other';
  confidence: {
    platform: number;
    contentType: number;
    format: number;
  };
}

// Enhanced content analysis
export function analyzeContent(text: string): ContentAnalysis {
  const words = text.toLowerCase().split(/\s+/);
  
  // Platform detection
  let platformScores = {
    youtube: 0,
    twitter: 0,
    tiktok: 0,
    instagram: 0,
  };

  // Content type and format detection
  let typeScores: Record<keyof typeof contentTypes, number> = {} as Record<keyof typeof contentTypes, number>;
  let formatScores: Record<keyof typeof contentFormats, number> = {} as Record<keyof typeof contentFormats, number>;

  words.forEach(word => {
    // Platform scoring
    if (word in youtubeTerms) platformScores.youtube++;
    if (word in twitterTerms) platformScores.twitter++;
    if (word in tiktokTerms) platformScores.tiktok++;
    if (word in instagramTerms) platformScores.instagram++;

    // Content type scoring
    Object.keys(contentTypes).forEach(type => {
      const key = type as keyof typeof contentTypes;
      if (word in contentTypes[key]) {
        typeScores[key] = (typeScores[key] || 0) + 1;
      }
    });

    // Format scoring
    Object.keys(contentFormats).forEach(format => {
      const key = format as keyof typeof contentFormats;
      if (word in contentFormats[key]) {
        formatScores[key] = (formatScores[key] || 0) + 1;
      }
    });
  });

  // Determine dominant platform
  const maxPlatformScore = Math.max(...Object.values(platformScores));
  const platform = maxPlatformScore > 0
    ? (Object.entries(platformScores).find(([_, score]) => score === maxPlatformScore)?.[0] as ContentAnalysis['platform'])
    : 'general';

  // Determine dominant content type
  const maxTypeScore = Math.max(...Object.values(typeScores));
  const contentType = maxTypeScore > 0
    ? (Object.entries(typeScores).find(([_, score]) => score === maxTypeScore)?.[0] as keyof typeof contentTypes)
    : 'other';

  // Determine dominant format
  const maxFormatScore = Math.max(...Object.values(formatScores));
  const format = maxFormatScore > 0
    ? (Object.entries(formatScores).find(([_, score]) => score === maxFormatScore)?.[0] as keyof typeof contentFormats)
    : 'other';

  return {
    platform,
    contentType: contentType as ContentAnalysis['contentType'],
    format: format as ContentAnalysis['format'],
    confidence: {
      platform: maxPlatformScore / words.length,
      contentType: maxTypeScore / words.length,
      format: maxFormatScore / words.length,
    },
  };
}

function getPlatformDictionary(platform: ContentAnalysis['platform']): Record<string, string> {
  switch (platform) {
    case 'youtube': return youtubeTerms;
    case 'twitter': return twitterTerms;
    case 'tiktok': return tiktokTerms;
    case 'instagram': return instagramTerms;
    default: return {};
  }
}

function findInFormatDictionary(word: string, format: keyof typeof contentFormats): string | null {
  const dictionary = contentFormats[format];
  if (!dictionary) return null;

  const key = Object.keys(dictionary).find(k => 
    k.toLowerCase() === word.toLowerCase() ||
    distance(k.toLowerCase(), word.toLowerCase()) <= 2
  );

  return key ? dictionary[key as keyof typeof dictionary] : null;
}

async function getContextualCorrection(
  word: string,
  context: string,
  analysis: ContentAnalysis
): Promise<string | null> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a text correction system specializing in ${analysis.platform} content.`
        },
        {
          role: "user",
          content: `In the context of "${context}", is "${word}" a valid term? If not, what's the correct form? Only respond with the corrected word or "VALID" if no correction is needed.`
        }
      ],
      temperature: 0.3,
      max_tokens: 50
    });

    const suggestion = response.choices[0]?.message?.content?.trim();
    return suggestion === "VALID" ? word : suggestion || null;
  } catch (error) {
    console.error('Error getting AI correction:', error);
    return null;
  }
}

export async function correctText(text: string, contextWindow: number = 100): Promise<string> {
  const words = text.split(/\s+/);
  const analysis = analyzeContent(text);
  const platformDict = getPlatformDictionary(analysis.platform);
  const results: CorrectionResult[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (!word) continue;

    // Get context window
    const contextStart = Math.max(0, i - Math.floor(contextWindow / 2));
    const contextEnd = Math.min(words.length, i + Math.floor(contextWindow / 2));
    const context = words.slice(contextStart, contextEnd).join(' ');

    // Check cache first
    const cacheKey = `${word}-${analysis.platform}-${analysis.contentType}`;
    const cached = correctionCache.get<CorrectionResult>(cacheKey);
    
    if (cached) {
      results.push(cached);
      continue;
    }

    // Try platform-specific dictionary
    if (word.toLowerCase() in platformDict) {
      const correction: CorrectionResult = {
        original: word,
        corrected: platformDict[word.toLowerCase()],
        confidence: 0.9,
        source: 'dictionary'
      };
      correctionCache.set(cacheKey, correction);
      results.push(correction);
      continue;
    }

    // Try format-specific dictionary
    const formatCorrection = findInFormatDictionary(word, analysis.format);
    if (formatCorrection) {
      const correction: CorrectionResult = {
        original: word,
        corrected: formatCorrection,
        confidence: 0.8,
        source: 'dictionary'
      };
      correctionCache.set(cacheKey, correction);
      results.push(correction);
      continue;
    }

    // Try AI-based correction
    const aiCorrection = await getContextualCorrection(word, context, analysis);
    if (aiCorrection) {
      const correction: CorrectionResult = {
        original: word,
        corrected: aiCorrection,
        confidence: 0.7,
        source: 'ai'
      };
      correctionCache.set(cacheKey, correction);
      results.push(correction);
      continue;
    }

    // No correction needed
    const noCorrection: CorrectionResult = {
      original: word,
      corrected: word,
      confidence: 1.0,
      source: 'none'
    };
    correctionCache.set(cacheKey, noCorrection);
    results.push(noCorrection);
  }

  const correctedText = results.map(r => r.corrected).join(' ');
  return correctedText || text;
}
