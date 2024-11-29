import { NextApiRequest, NextApiResponse } from 'next';
import { Pinecone, RecordMetadata } from '@pinecone-database/pinecone';
import { OpenAIEmbeddings } from '@langchain/openai';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { transcribeYouTube, transcribeWebPage } from '~/utils/transcription';
import { formatContentForVectorDB } from '~/utils/textProcessing';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ message: 'URL is required' });
    }

    // Determine if it's a YouTube URL or regular webpage
    const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
    const transcriptionResult = isYouTube
      ? await transcribeYouTube(url)
      : await transcribeWebPage(url);

    // Clean and format the content based on its type
    const cleanedContent = formatContentForVectorDB(
      transcriptionResult.text,
      isYouTube ? 'youtube' : 'webpage'
    );

    // Initialize text splitter
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    // Split text into chunks
    const docs = await splitter.createDocuments([cleanedContent]);

    // Initialize Pinecone
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });

    const index = pinecone.index(process.env.PINECONE_INDEX!);
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    // Create vectors from chunks
    const vectors = await Promise.all(
      docs.map(async (doc, i) => {
        const embedding = await embeddings.embedQuery(doc.pageContent);
        return {
          id: `${transcriptionResult.title || url}-${i}`,
          values: embedding,
          metadata: {
            text: doc.pageContent,
            source: url,
            title: transcriptionResult.title,
            type: isYouTube ? 'youtube' : 'webpage',
            author: transcriptionResult.author,
            duration: transcriptionResult.duration,
            processedAt: new Date().toISOString(),
          } as RecordMetadata,
        };
      })
    );

    // Upsert vectors to Pinecone
    await index.upsert(vectors);

    res.status(200).json({
      message: 'URL content processed successfully',
      type: isYouTube ? 'youtube' : 'webpage',
      title: transcriptionResult.title,
      chunks: vectors.length,
    });
  } catch (error: any) {
    console.error('URL processing error:', error);
    res.status(500).json({ message: 'Error processing URL', error: error.message });
  }
}
