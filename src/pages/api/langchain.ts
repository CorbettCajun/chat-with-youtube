/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Pinecone } from "@pinecone-database/pinecone";
import { ChatOpenAI } from "@langchain/openai";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";
import { ConversationalRetrievalQAChain } from "langchain/chains";
import { type NextApiRequest, type NextApiResponse } from "next";
import type { Index } from "@pinecone-database/pinecone";
import { env } from "~/env.mjs";
import { BaseCallbackConfig, Callbacks } from "@langchain/core/callbacks/manager";
import { VectorStore } from "@langchain/core/vectorstores";
import { Document } from "@langchain/core/documents";

// Enhanced type definitions
interface LangChainRequestBody {
  question: string;
  chat_history?: [string, string][]; // [human, ai] pairs
}

interface ErrorResponse {
  message: string;
  details?: string;
}

interface SuccessResponse {
  answer: string;
  sources?: string[];
}

interface DocumentMetadata {
  source: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      message: 'Method not allowed',
      details: 'Only POST requests are accepted'
    });
  }

  try {
    // Validate environment variables
    if (!env.OPENAI_API_KEY || !env.PINECONE_API_KEY || !env.PINECONE_INDEX) {
      throw new Error('Missing required environment variables');
    }

    const { question, chat_history = [] } = req.body as LangChainRequestBody;

    if (!question?.trim()) {
      return res.status(400).json({ 
        message: "Invalid request",
        details: "Question cannot be empty" 
      });
    }

    // Initialize services with configuration
    const client = new Pinecone({
      apiKey: env.PINECONE_API_KEY,
    });
    
    const pineconeIndex: Index = client.Index(env.PINECONE_INDEX);

    // Configure embeddings with retry logic
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: env.OPENAI_API_KEY,
      modelName: "text-embedding-ada-002",
      maxRetries: 3,
      timeout: 30000 // 30 seconds
    });

    // Initialize vector store with error handling
    const vectorStore = await PineconeStore.fromExistingIndex(
      embeddings,
      {
        pineconeIndex: pineconeIndex as any,
        ...(env.PINECONE_NAMESPACE ? { namespace: env.PINECONE_NAMESPACE } : {}),
      }
    );

    // Configure chat model with safety parameters
    const model = new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      openAIApiKey: env.OPENAI_API_KEY,
      temperature: 0.7,
      maxTokens: 500,
      timeout: 60000, // 60 seconds
    });
    
    // Create retriever from vector store
    const retriever = vectorStore.asRetriever({
      searchKwargs: {
        k: 5,
        includeValues: true,
        includeMetadata: true,
      } as any,
    });

    // Create chain with enhanced configuration
    const chain = ConversationalRetrievalQAChain.fromLLM(
      model,
      retriever as any,
      {
        verbose: env.NODE_ENV === 'development',
        returnSourceDocuments: true,
        questionGeneratorChainOptions: {
          template: `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question.

Chat History:
{chat_history}
Follow Up Input: {question}
Standalone question:`,
        }
      }
    );

    // Format chat history and execute query
    const formattedHistory = chat_history
      .map(([human, ai]: [string, string]) => `Human: ${human}\nAssistant: ${ai}`)
      .join('\n');

    const response = await chain.call({ 
      question, 
      chat_history: formattedHistory
    });

    return res.status(200).json({ 
      answer: response.text,
      sources: response.sourceDocuments?.map((doc: { metadata: DocumentMetadata }) => doc.metadata.source)
    });

  } catch (error) {
    console.error('Error details:', error);
    
    // Enhanced error handling
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    const statusCode = errorMessage.includes('rate limit') ? 429 
      : errorMessage.includes('not allowed') ? 403 
      : errorMessage.includes('invalid') ? 400 
      : 500;

    return res.status(statusCode).json({ 
      message: 'Error processing request',
      details: errorMessage
    });
  }
}
