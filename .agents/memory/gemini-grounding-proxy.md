---
name: Gemini Google Search grounding via Replit proxy
description: How to make Gemini web-search grounding work at runtime through the Replit AI Integrations proxy.
---

# Gemini Google Search grounding through the Replit AI proxy

Google Search grounding (`config.tools: [{ googleSearch: {} }]`) **does work** at runtime through the Replit AI Integrations Gemini proxy and returns real, current web results plus `candidates[0].groundingMetadata.groundingChunks` (each `chunk.web.uri` is a `vertexaisearch.cloud.google.com/grounding-api-redirect/...` link, `chunk.web.title` a label).

**Why it matters:** the deployed Express server cannot use the agent's own `webSearch`/`webFetch` tools (those are agent/sandbox-only). Grounded Gemini is the way to do live web data collection from inside a running app without extra API keys.

**Critical gotcha:** grounding only works when the Gemini client sets `httpOptions.apiVersion: ""`. With the SDK default (`/v1beta/`) the call fails with `{"error":{"code":"INVALID_ENDPOINT","message":"Endpoint: 'POST /v1beta/models/...:generateContent' is not supported."}}`. The project's shared client (`lib/integrations-gemini-ai/src/client.ts`) already sets `apiVersion: ""`, so use that client, don't hand-roll a `new GoogleGenAI(...)` without it.

**How to apply:** for "structured JSON from web search" tasks, do two calls — (1) grounded call (tools googleSearch, NO responseMimeType json; JSON mode + tools don't combine well) to fetch text + grounding chunks, then (2) a plain call with `responseMimeType: "application/json"` to structure it. When storing a source URL the model chose, validate it against the set of real grounding-chunk URIs to block hallucinated links.
