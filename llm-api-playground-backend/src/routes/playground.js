import { Router } from "express";
import { streamText, generateText } from "ai";
import { groq } from "../config/groq.js";
import { inputLimits } from "../config/security.js";

const router = Router();

const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

const getOptions = (req) => {
  const { prompt, systemPrompt, temperature } = req.body;

  return {
    prompt,
    system: systemPrompt || "You are a helpful AI assistant.",
    temperature: temperature ?? 0.7,
  };
};

// Shared validation
const validateRequest = (req, res) => {
  const { prompt, systemPrompt, temperature } = req.body ?? {};
  const {
    maxPromptLength,
    maxSystemPromptLength,
    minTemperature,
    maxTemperature,
  } = inputLimits;

  let message = null;

  if (typeof prompt !== "string" || !prompt.trim()) {
    message = "Prompt is required";
  } else if (prompt.length > maxPromptLength) {
    message = `Prompt must be at most ${maxPromptLength} characters`;
  } else if (systemPrompt !== undefined && typeof systemPrompt !== "string") {
    message = "System prompt must be a string";
  } else if (systemPrompt && systemPrompt.length > maxSystemPromptLength) {
    message = `System prompt must be at most ${maxSystemPromptLength} characters`;
  } else if (
    temperature !== undefined &&
    (typeof temperature !== "number" ||
      temperature < minTemperature ||
      temperature > maxTemperature)
  ) {
    message = `Temperature must be a number between ${minTemperature} and ${maxTemperature}`;
  }

  if (message) {
    res.status(400).json({
      success: false,
      message,
    });

    return false;
  }

  return true;
};

// API 1: Streaming response
router.post("/stream", async (req, res) => {
  // Stop generating (and stop paying for tokens) if the client disconnects.
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });

  try {
    if (!validateRequest(req, res)) return;

    const result = streamText({
      model: groq(MODEL),
      ...getOptions(req),
      abortSignal: controller.signal,
    });

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");

    for await (const chunk of result.textStream) {
      res.write(chunk);
    }

    res.end();
  } catch (error) {
    if (controller.signal.aborted) return;

    console.error("streamText error:", error);

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Failed to generate streaming response",
      });
    } else {
      res.end();
    }
  }
});

// API 2: Complete response
router.post("/generate", async (req, res) => {
  try {
    if (!validateRequest(req, res)) return;

    const result = await generateText({
      model: groq(MODEL),
      ...getOptions(req),
    });

    return res.status(200).json({
      success: true,
      text: result.text,
    });
  } catch (error) {
    console.error("generateText error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate response",
    });
  }
});

export default router;
