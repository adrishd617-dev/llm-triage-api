import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { processTriage } from "../src/client.js";

dotenv.config();

const cases = JSON.parse(fs.readFileSync(path.resolve("evals/cases.json"), "utf-8"));

async function runEval() {
  let passed = 0;
  console.log("Starting evaluation suite execution...\n");

  for (const c of cases) {
    const res = await processTriage(c.input);
    const resultCategory = res.data?.category;
    const isSuccess = resultCategory === c.expected;

    if (isSuccess) passed++;
    console.log(`[${isSuccess ? "PASS" : "FAIL"}] Input: "${c.input}" | Got: ${resultCategory} | Expected: ${c.expected}`);
  }

  console.log(`\nEval Result: ${passed}/${cases.length} (${((passed / cases.length) * 100).toFixed(0)}%)`);
}

runEval();
