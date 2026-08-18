# Support Message Triage API

A production-ready API endpoint that receives unstructured customer support messages and returns clean, schema-validated JSON routing data.

## JOB CARD Summary
- **Input:** `{ "text": "string (1-2000 characters)" }`
- **Output:** `{ "category": "billing"|"bug"|"feature"|"other", "urgency": "low"|"normal"|"high", "confidence": float, "reason": "string" }`
- **Forbidden Rules:** No markdown wrapping, no invented categories outside enum, no unhandled execution crashes.

## Quickstart & Runnable Curl
Start the application server:
```bash
npm install
npm start
