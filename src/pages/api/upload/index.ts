import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs/promises';
import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAIEmbeddings } from '@langchain/openai';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { cleanText } from '../../../utils/textProcessing';
import { detectContentType } from '../../../utils/contentTypeDetection';

export const config = {
  api: {
    bodyParser: false,
    responseLimit: '10mb', // Increase response size limit
  },
};

// Supported file types
const SUPPORTED_FILE_TYPES = [
  'text/plain', 
  'application/pdf', 
  'application/msword', 
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      message: 'Method not allowed', 
      supportedMethods: ['POST'] 
    });
  }

  try {
    // Configure formidable with more robust options
    const form = formidable({
      maxFileSize: 50 * 1024 * 1024, // 50MB max file size
      keepExtensions: true,
      multiples: false,
    });

    const [fields, files] = await new Promise<[formidable.Fields, formidable.Files]>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    const file = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!file) {
      return res.status(400).json({ 
        message: 'No file uploaded', 
        hint: 'Please upload a file using the form input named "file"' 
      });
    }

    // Validate file type
    if (!SUPPORTED_FILE_TYPES.includes(file.mimetype || '')) {
      return res.status(400).json({ 
        message: 'Unsupported file type', 
        supportedTypes: SUPPORTED_FILE_TYPES 
      });
    }

    // Read file content
    const content = await fs.readFile(file.filepath, 'utf8');

    // Detect content type and clean text
    const contentType = detectContentType(file.mimetype || '');
    const cleanedContent = cleanText(content, {
      removeUrls: true,
      removeEmails: true,
      removeSpecialChars: true,
      removeExtraSpaces: true,
    });

    // Initialize text splitter with adaptive chunk size
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: contentType === 'document' ? 1500 : 1000,
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

    // Create vectors from chunks with enhanced metadata
    const vectors = await Promise.all(
      docs.map(async (doc, index) => {
        const embedding = await embeddings.embedQuery(doc.pageContent);
        return {
          id: `${file.newFilename}_${index}`,
          values: embedding,
          metadata: {
            text: doc.pageContent,
            source: file.newFilename,
            contentType: contentType,
            originalFileName: file.originalFilename,
            uploadTimestamp: new Date().toISOString(),
          }
        };
      })
    );

    // Upsert vectors to Pinecone
    await index.upsert(vectors);

    // Clean up temporary file
    await fs.unlink(file.filepath);

    return res.status(200).json({ 
      message: 'File uploaded and processed successfully', 
      chunks: vectors.length,
      contentType: contentType,
    });

  } catch (error) {
    console.error('File upload error:', error);
    return res.status(500).json({ 
      message: 'Internal server error during file upload', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}
