import { type NextApiRequest, type NextApiResponse } from "next";
import { google } from "googleapis";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { youtubeKey } = req.body;

  if (!youtubeKey) {
    return res.status(400).json({ error: "YouTube API key is required" });
  }

  try {
    // Initialize the YouTube API client
    const youtube = google.youtube({
      version: "v3",
      auth: youtubeKey,
    });

    // Test the API key by making a simple search request
    await youtube.search.list({
      part: ["snippet"],
      q: "test",
      maxResults: 1,
    });

    // If we get here, the API key is valid
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("YouTube API test error:", error);
    return res.status(400).json({
      error: "Invalid YouTube API key or API quota exceeded",
    });
  }
}
