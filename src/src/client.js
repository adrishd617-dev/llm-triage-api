import fs from "fs";
import path from "path";
import OpenAI from "openai";
import { TriageOutputSchema } from "./schema.js";

const client = new OpenAI({
  baseURL: process.env.LLM_BASE_URL || "https://openrouter.ai/api/v1",
  apiKey: process.env.LLM_API_KEY || "dummy-key",
  timeout: 30000, // Explicit 30-second hard timeout
  maxRetries: 0   // Explicit retry policy managed below
});

const systemPrompt = fs.readFileSync(path.resolve("prompts/triage-v1.md"), "utf-8");

function cleanJson(rawText) {
  return rawText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
}

async function executeWithRetry(messages) {
  const maxAttempts = 3;
  let delayMs = 1000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const startTime = Date.now();
    try {
      const response = await client.chat.completions.create({
        model: process.env.LLM_MODEL || "openrouter/free",
        temperature: 0.1,
        messages
      });
      return { response, durationMs: Date.now() - startTime };
    } catch (err) {
      const status = err.status || 500;
      // Retry only on rate limits (429), server errors (5xx), and timeouts
      const isRetryable = status === 429 || status >= 500 || err.name === "APIConnectionTimeoutError";

      if (!isRetryable || attempt === maxAttempts) {
        throw err;
      }

      // Exponential backoff with jitter
      await new Promise((resolve) => setTimeout(resolve, delayMs + Math.random() * 200));
      delayMs *= 2;
    }
  }
}

export async function processTriage(inputText) {
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: JSON.stringify({ text: inputText }) }
  ];

  let rawOutput = "";
  let repaired = false;

  try {
    let { response, durationMs } = await executeWithRetry(messages);
    rawOutput = response.choices[0]?.message?.content || "";

    let parsed = JSON.parse(cleanJson(rawOutput));
    let validation = TriageOutputSchema.safeParse(parsed);

    // One-attempt Repair Retry Loop
    if (!validation.success) {
      repaired = true;
      const repairMessages = [
        ...messages,
        { role: "assistant", content: rawOutput },
        {
          role: "user",
          content: `Your previous response failed schema validation: ${JSON.stringify(validation.error.issues)}. Return ONLY valid corrected raw JSON.`
        }
      ];

      const repairRes = await executeWithRetry(repairMessages);
      rawOutput = repairRes.response.choices[0]?.message?.content || "";
      durationMs += repairRes.durationMs;

      parsed = JSON.parse(cleanJson(rawOutput));
      validation = TriageOutputSchema.safeParse(parsed);
    }

    if (!validation.success) {
      throw new Error("Validation failed after repair attempt");
    }

    // Cost / Execution Log
    console.log(JSON.stringify({
      prompt_version: "triage-v1",
      model: process.env.LLM_MODEL,
      input_tokens: response.usage?.prompt_tokens || 0,
      output_tokens: response.usage?.completion_tokens || 0,
      duration_ms: durationMs,
      repaired
    }));

    return { status: 200, data: validation.data };

  } catch (err) {
    // Write unrepairable error output to quarantine log
    const logDirectory = path.resolve("logs");
    if (!fs.existsSync(logDirectory)) {
      fs.mkdirSync(logDirectory, { recursive: true });
    }

    const quarantineLine = JSON.stringify({
      timestamp: new Date().toISOString(),
      input: inputText,
      rawOutput,
      error: err.message
    }) + "\n";

    fs.appendFileSync(path.join(logDirectory, "quarantine.jsonl"), quarantineLine);

    if (err.name === "APIConnectionTimeoutError") {
      return { status: 504, error: "LLM request timed out." };
    }
    return { status: 422, error: "Model output failed schema validation." };
  }
}
