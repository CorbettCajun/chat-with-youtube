import { type NextApiRequest, type NextApiResponse } from "next";
import { Pinecone } from "@pinecone-database/pinecone";
import { getErrorMessage } from '~/utils/error';
import { env } from '~/env.mjs';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    if (!env.PINECONE_API_KEY || !env.PINECONE_INDEX) {
      return res.status(500).json({
        message: "Pinecone API key or index name not found",
      });
    }

    // Initialize Pinecone client
    const client = new Pinecone({
      apiKey: env.PINECONE_API_KEY,
    });

    // Get index instance
    const pineconeIndex = client.Index(env.PINECONE_INDEX);

    // Get index statistics
    const stats = await pineconeIndex.describeIndexStats();

    return res.status(200).json(stats);
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    return res.status(500).json({ message: errorMessage });
  }
}
