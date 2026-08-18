import express from "express";
import dotenv from "dotenv";
import { InputSchema } from "./schema.js";
import { processTriage } from "./client.js";

dotenv.config();

const app = express();
app.use(express.json());

app.post("/triage", async (req, res) => {
  // 1. Input Validation (HTTP 400)
  const inputCheck = InputSchema.safeParse(req.body);
  if (!inputCheck.success) {
    return res.status(400).json({
      error: "Invalid request payload",
      details: inputCheck.error.issues
    });
  }

  // 2. Kill Switch (HTTP 503)
  if (process.env.LLM_ENABLED === "false") {
    return res.status(503).json({
      category: "other",
      urgency: "normal",
      confidence: 0.0,
      reason: "Service disabled via kill switch."
    });
  }

  // 3. Stub Mode (HTTP 200)
  if (process.env.LLM_STUB === "1") {
    return res.status(200).json({
      category: "billing",
      urgency: "high",
      confidence: 1.0,
      reason: "STUB MODE: Hardcoded valid response."
    });
  }

  // 4. Model Process Pipeline
  const result = await processTriage(inputCheck.data.text);
  return res.status(result.status).json(result.status === 200 ? result.data : { error: result.error });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
