import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import Redis from "ioredis";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ⭐ Connect to Redis
const redis = new Redis(process.env.REDIS_URL);

// ---------------------------------
// REAL AI VIDEO GENERATOR (PIKA)
// ---------------------------------
async function generateVideoReal(prompt, duration, ratio, style) {
  try {
    const response = await fetch("https://api.pika.art/v1/video", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.PIKA_API_KEY}`
      },
      body: JSON.stringify({
        prompt,
        duration,
        aspect_ratio: ratio,
        style
      })
    });

    const data = await response.json();
    return data.video_url; // Important!
  } catch (error) {
    console.error("Pika API Error:", error);
    return null;
  }
}

// ---------------------------------
// FALLBACK DEMO VIDEO
// ---------------------------------
async function generateVideoDemo() {
  return "https://samplelib.com/lib/preview/mp4/sample-5s.mp4";
}

// ---------------------------------
// MAIN API
// ---------------------------------
app.post("/api/generate-video", async (req, res) => {
  const { prompt, duration, ratio, style } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  const jobId = "job_" + Date.now();

  // Save initial job status in Redis
  await redis.set(
    jobId,
    JSON.stringify({ prompt, status: "processing" }),
    "EX",
    3600
  );

  let videoUrl = null;

  // Try real PIKA API
  if (process.env.PIKA_API_KEY) {
    videoUrl = await generateVideoReal(prompt, duration, ratio, style);
  }

  // If no real API available → use demo
  if (!videoUrl) {
    videoUrl = await generateVideoDemo();
  }

  // Save result
  await redis.set(
    jobId,
    JSON.stringify({ prompt, status: "done", videoUrl }),
    "EX",
    3600
  );

  res.json({ jobId, videoUrl });
});

// ---------------------------------
// JOB STATUS CHECKER
// ---------------------------------
app.get("/api/status/:id", async (req, res) => {
  const data = await redis.get(req.params.id);
  if (!data) return res.json({ error: "Job not found" });
  res.json(JSON.parse(data));
});

// ---------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Backend running on PORT", PORT));
