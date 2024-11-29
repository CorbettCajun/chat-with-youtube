import { OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { PineconeStore } from "@langchain/pinecone";
import { type NextApiRequest, type NextApiResponse } from "next";
import { Pinecone } from "@pinecone-database/pinecone";
import { getErrorMessage } from '~/utils/error';
import { env } from '~/env.mjs';

// Type definitions
type PineconeRequestBody = {
  text: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { text } = req.body as PineconeRequestBody;

    if (!text) {
      return res.status(400).json({ message: "No text provided" });
    }

    if (!env.PINECONE_API_KEY || !env.PINECONE_INDEX) {
      return res.status(500).json({
        message: "Pinecone API key or index name not found",
      });
    }

    // Create text splitter
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const docs = await textSplitter.createDocuments([text]);

    // Create embeddings
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: env.OPENAI_API_KEY,
      modelName: "text-embedding-ada-002",
    });

    // Initialize Pinecone client
    const client = new Pinecone({
      apiKey: env.PINECONE_API_KEY,
    });

    // Get index instance
    const pineconeIndex = client.Index(env.PINECONE_INDEX);

    // Store documents in Pinecone
    await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex: pineconeIndex as any, // Type cast to avoid version conflict
      namespace: env.PINECONE_NAMESPACE,
    }).then(store => store.addDocuments(docs));

    return res.status(200).json({ message: "Successfully indexed text" });
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    return res.status(500).json({ message: errorMessage });
  }
}
