import { z } from "zod";

export const InputSchema = z.object({
  text: z.string().min(1, "Text field cannot be empty").max(2000, "Text exceeds 2000 characters limit")
});

export const TriageOutputSchema = z.object({
  category: z.enum(["billing", "bug", "feature", "other"]),
  urgency: z.enum(["low", "normal", "high"]),
  confidence: z.number().min(0).max(1),
  reason: z.string().max(200)
});
