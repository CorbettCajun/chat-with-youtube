import { type NextApiRequest, type NextApiResponse } from "next";
import { Pinecone } from "@pinecone-database/pinecone";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const { pineconeKey } = req.body;

  if (!pineconeKey) {
    return res.status(400).json({
      success: false,
      message: "Pinecone API key is required",
    });
  }

  try {
    // Initialize Pinecone client
    const pinecone = new Pinecone({
      apiKey: pineconeKey
    });
    
    // Try to list indexes to validate the API key
    const indexList = await pinecone.listIndexes();
    
    // Extract index names from the response
    const indexNames = Object.keys(indexList);
    
    // If we get here, the key is valid
    return res.status(200).json({ 
      success: true,
      indexes: indexNames
    });
  } catch (error: any) {
    console.error("Pinecone key validation error:", error);
    
    // More specific error messages based on the error type
    if (error?.message?.includes('Unauthorized')) {
      return res.status(400).json({
        success: false,
        message: "Invalid Pinecone API key. Please check your key and try again.",
      });
    }
    
    if (error?.message?.includes('connect')) {
      return res.status(400).json({
        success: false,
        message: "Could not connect to Pinecone. Please check your internet connection.",
      });
    }
    
    return res.status(400).json({
      success: false,
      message: error?.message || "Failed to validate Pinecone API key",
    });
  }
}
