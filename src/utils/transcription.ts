import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import ytdl from 'ytdl-core';

const execAsync = promisify(exec);

interface TranscriptionResult {
  text: string;
  source: string;
  title?: string;
  duration?: string;
  author?: string;
}

export async function transcribeVideo(filePath: string): Promise<TranscriptionResult> {
  try {
    // Use whisper.cpp for transcription (assuming it's installed in the system)
    const outputPath = path.join(process.cwd(), 'temp', 'transcript.txt');
    
    // Make sure the temp directory exists
    await fs.promises.mkdir(path.join(process.cwd(), 'temp'), { recursive: true });
    
    // Run whisper.cpp command
    const { stdout } = await execAsync(`whisper "${filePath}" --output_txt`);
    
    // Read the transcription
    const text = await fs.promises.readFile(outputPath, 'utf-8');
    
    return {
      text,
      source: path.basename(filePath),
    };
  } catch (error) {
    console.error('Transcription error:', error);
    throw new Error('Failed to transcribe video');
  }
}

export async function transcribeYouTube(url: string): Promise<TranscriptionResult> {
  try {
    // Get video info
    const info = await ytdl.getInfo(url);
    const videoTitle = info.videoDetails.title;
    const author = info.videoDetails.author.name;
    const duration = info.videoDetails.lengthSeconds;
    
    // Download audio only
    const tempAudioPath = path.join(process.cwd(), 'temp', 'audio.mp3');
    await new Promise((resolve, reject) => {
      ytdl(url, { filter: 'audioonly' })
        .pipe(fs.createWriteStream(tempAudioPath))
        .on('finish', resolve)
        .on('error', reject);
    });
    
    // Transcribe the audio
    const { text } = await transcribeVideo(tempAudioPath);
    
    // Clean up
    await fs.promises.unlink(tempAudioPath);
    
    return {
      text,
      source: url,
      title: videoTitle,
      duration: duration.toString(),
      author,
    };
  } catch (error) {
    console.error('YouTube transcription error:', error);
    throw new Error('Failed to transcribe YouTube video');
  }
}

export async function transcribeWebPage(url: string): Promise<TranscriptionResult> {
  try {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle0' });
    
    // Extract main content (customize selectors based on common website structures)
    const text = await page.evaluate(() => {
      // Remove unwanted elements
      const elementsToRemove = document.querySelectorAll('header, footer, nav, aside, script, style, .ads, #comments');
      elementsToRemove.forEach(el => el.remove());
      
      // Get main content
      const mainContent = document.querySelector('main, article, .content, #content, .post');
      if (mainContent) {
        return mainContent.textContent || '';
      }
      
      // Fallback to body content
      return document.body.textContent || '';
    });
    
    const title = await page.title();
    await browser.close();
    
    // Clean up the text
    const cleanText = text
      .replace(/\\s+/g, ' ')
      .replace(/\\n+/g, '\\n')
      .trim();
    
    return {
      text: cleanText,
      source: url,
      title,
    };
  } catch (error) {
    console.error('Web page transcription error:', error);
    throw new Error('Failed to transcribe web page');
  }
}
