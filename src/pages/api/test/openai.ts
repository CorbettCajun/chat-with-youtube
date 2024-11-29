import { type NextApiRequest, type NextApiResponse } from "next";
import OpenAI from "openai";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const { openaiKey } = req.body;

  if (!openaiKey) {
    return res.status(400).json({
      success: false,
      message: "OpenAI API key is required",
    });
  }

  if (!openaiKey.startsWith('sk-')) {
    return res.status(400).json({
      success: false,
      message: "Invalid OpenAI API key format. Key should start with 'sk-'",
    });
  }

  try {
    const openai = new OpenAI({ apiKey: openaiKey });
    
    // Test the API key by making a simple request
    const models = await openai.models.list();
    
    // Verify we got a valid response
    if (!Array.isArray(models.data) || models.data.length === 0) {
      throw new Error("Unable to fetch models with provided API key");
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("OpenAI validation error:", error);
    
    // Handle specific error cases
    if (error?.status === 401) {
      return res.status(400).json({
        success: false,
        message: "Invalid OpenAI API key. Please check your key and try again.",
      });
    }
    
    if (error?.status === 429) {
      return res.status(400).json({
        success: false,
        message: "Rate limit exceeded. Please try again in a few minutes.",
      });
    }
    
    if (error?.message?.includes('fetch')) {
      return res.status(400).json({
        success: false,
        message: "Could not connect to OpenAI. Please check your internet connection.",
      });
    }
    
    return res.status(400).json({
      success: false,
      message: error?.message || "Failed to validate OpenAI API key",
    });
  }
}
