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

// ⭐ Connect to Redis (Render Key Value)
const redis = new Redis(process.env.REDIS_URL);

// ---------- REAL AI VIDEO GENERATION SECTION ----------
async function generateVideoReal(prompt, duration, ratio, style) {
  // Example using PIKA API (Replace KEY)
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
    return data.video_url; // IMPORTANT
  } catch (error) {
    console.error("Pika API Error:", error);
    return null;
  }
}


// ---------- FALLBACK DEMO GENERATOR ----------
async function generateVideoDemo() {
  return "https://samplelib.com/lib/preview/mp4/sample-5s.mp4";
}


// ---------- MAIN API ----------
app.post("/api/generate-video", async (req, res) => {
  const { prompt, duration, ratio, style } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Prompt required" });
  }

  const jobId = "job_" + Date.now();

  await redis.set(jobId, JSON.stringify({
    prompt,
    status: "processing"
  }), "EX", 3600);

  let videoUrl = null;

  // 1️⃣ Try real AI API
  if (process.env.PIKA_API_KEY) {
    videoUrl = await generateVideoReal(prompt, duration, ratio, style);
  }

  // 2️⃣ If real API fails → fallback demo
  if (!videoUrl) {
    videoUrl = await generateVideoDemo();
  }

  await redis.set(jobId, JSON.stringify({
    prompt,
    status: "done",
    videoUrl
  }), "EX", 3600);

  res.json({
    jobId,
    videoUrl
  });
});

// Status checker
app.get("/api/status/:id", async (req, res) => {
  const data = await redis.get(req.params.id);
  if (!data) return res.json({ error: "Job not found" });
  res.json(JSON.parse(data));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Backend running on", PORT));
