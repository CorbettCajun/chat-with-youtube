import { type NextApiRequest, type NextApiResponse } from "next";
import { Pinecone } from "@pinecone-database/pinecone";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const { pineconeIndex, pineconeKey } = req.body;

  if (!pineconeIndex) {
    return res.status(400).json({
      success: false,
      message: "Pinecone index name is required",
    });
  }

  if (!pineconeKey) {
    return res.status(400).json({
      success: false,
      message: "Pinecone API key is required",
    });
  }

  try {
    const pinecone = new Pinecone({
      apiKey: pineconeKey,
    });

    // Try to describe the index to validate it exists
    try {
      await pinecone.describeIndex(pineconeIndex);
      return res.status(200).json({ success: true });
    } catch (error: any) {
      console.error("Pinecone index validation error:", error);
      if (error?.message?.includes('not found')) {
        return res.status(400).json({
          success: false,
          message: `Index '${pineconeIndex}' not found. Please check the index name and try again.`,
        });
      }
      return res.status(400).json({
        success: false,
        message: error?.message || "Failed to validate Pinecone index",
      });
    }
  } catch (error: any) {
    console.error("Pinecone client error:", error);
    return res.status(400).json({
      success: false,
      message: error?.message || "Failed to connect to Pinecone",
    });
  }
}
