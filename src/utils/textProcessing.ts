import { load } from 'cheerio';
import { correctText } from './smartCorrection';

interface CleanTextOptions {
  removeTimestamps?: boolean;
  removeSpecialChars?: boolean;
  removeBrackets?: boolean;
  removeUrls?: boolean;
  removeEmails?: boolean;
  removeExtraSpaces?: boolean;
  removeEmptyLines?: boolean;
}

export function cleanText(text: string, options: CleanTextOptions = {}): string {
  const {
    removeTimestamps = true,
    removeSpecialChars = true,
    removeBrackets = true,
    removeUrls = true,
    removeEmails = true,
    removeExtraSpaces = true,
    removeEmptyLines = true,
  } = options;

  let cleaned = text;

  // Remove timestamps (e.g., [00:00], 00:00, [0:00:00], etc.)
  if (removeTimestamps) {
    cleaned = cleaned.replace(/\[?\d{1,2}:\d{2}(:\d{2})?\]?/g, '');
    cleaned = cleaned.replace(/\(\d{1,2}:\d{2}(:\d{2})?\)/g, '');
  }

  // Remove URLs
  if (removeUrls) {
    cleaned = cleaned.replace(/https?:\/\/\S+/g, '');
    cleaned = cleaned.replace(/www\.\S+/g, '');
  }

  // Remove email addresses
  if (removeEmails) {
    cleaned = cleaned.replace(/[\w.-]+@[\w.-]+\.\w+/g, '');
  }

  // Remove text within brackets
  if (removeBrackets) {
    cleaned = cleaned.replace(/\[.*?\]/g, '');
    cleaned = cleaned.replace(/\(.*?\)/g, '');
    cleaned = cleaned.replace(/\{.*?\}/g, '');
  }

  // Remove special characters but keep basic punctuation
  if (removeSpecialChars) {
    cleaned = cleaned.replace(/[^\w\s.,!?-]/g, '');
  }

  // Remove extra whitespace
  if (removeExtraSpaces) {
    cleaned = cleaned.replace(/\s+/g, ' ');
  }

  // Remove empty lines
  if (removeEmptyLines) {
    cleaned = cleaned.split('\n')
      .filter(line => line.trim().length > 0)
      .join('\n');
  }

  return cleaned.trim();
}

export function cleanWebPageContent(html: string): string {
  const $ = load(html);

  // Remove unwanted elements
  $('script, style, noscript, iframe, img, svg, header, footer, nav, aside, .ad, .advertisement, .social-share').remove();
  
  // Remove comments
  $('*').contents().filter(function() {
    return this.type === 'comment';
  }).remove();

  // Extract main content
  const mainContent = $('main, article, .content, #content, .post').text() || $('body').text();

  // Clean the extracted text
  return cleanText(mainContent, {
    removeTimestamps: true,
    removeSpecialChars: true,
    removeBrackets: true,
    removeUrls: true,
    removeEmails: true,
    removeExtraSpaces: true,
    removeEmptyLines: true,
  });
}

export function cleanTranscript(transcript: string): string {
  return cleanText(transcript, {
    removeTimestamps: true,
    removeSpecialChars: false, // Keep more punctuation for transcripts
    removeBrackets: true,
    removeUrls: true,
    removeEmails: true,
    removeExtraSpaces: true,
    removeEmptyLines: true,
  });
}

export function cleanYouTubeTranscript(transcript: string): string {
  let cleaned = transcript;

  // Remove speaker labels (e.g., "[Speaker 1]:", "Speaker:", etc.)
  cleaned = cleaned.replace(/\[?Speaker\s*\d*\]?:\s*/gi, '');
  cleaned = cleaned.replace(/\[.*?\]:\s*/g, '');

  // Remove YouTube-specific annotations
  cleaned = cleaned.replace(/\[Music\]/gi, '');
  cleaned = cleaned.replace(/\[Applause\]/gi, '');
  cleaned = cleaned.replace(/\[Laughter\]/gi, '');
  cleaned = cleaned.replace(/\[Background Noise\]/gi, '');
  cleaned = cleaned.replace(/\[Inaudible\]/gi, '');

  // Apply general transcript cleaning
  return cleanTranscript(cleaned);
}

export async function formatContentForVectorDB(content: string, type: 'webpage' | 'youtube' | 'transcript'): Promise<string> {
  // First clean the text based on type
  let cleanedText = '';
  switch (type) {
    case 'webpage':
      cleanedText = cleanWebPageContent(content);
      break;
    case 'youtube':
      cleanedText = cleanYouTubeTranscript(content);
      break;
    case 'transcript':
      cleanedText = cleanTranscript(content);
      break;
    default:
      cleanedText = cleanText(content);
  }

  // Then apply smart correction
  const correctedText = await correctText(cleanedText);

  return correctedText;
}
