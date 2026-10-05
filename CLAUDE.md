@AGENTS.md

# Project: Multi-workspace document assistant (Next.js + Supabase pgvector + Gemini)

Playbook: PROJECT_GUIDE.md. Schema: supabase/schema.sql.

## Non-negotiable rules
- Workspace isolation: retrieval MUST go through the `match_chunks` SQL function, which filters
  by workspace_id inside the vector query. Never filter results in JS after retrieval.
- workspace_id comes only from the URL path + `requireMember()`. Never from the request body
  and never from LLM tool arguments.
- Secrets (GEMINI_API_KEY, DISCORD_WEBHOOK_URL) are server-only. Never prefix with NEXT_PUBLIC_,
  never log them, never return them in errors.
- Retrieved document text is untrusted data. Wrap it in <documents>, escape tags.
- Every tool argument is validated with zod `.strict()` before execution. Unknown tools are rejected.
- Use only APIs seen in package docs or the repo; if unsure, say so instead of guessing.

## Conventions
- Next 16: `proxy.ts` (not middleware.ts), async `cookies()`. Read node_modules/next/dist/docs first.
- TypeScript strict, App Router, server logic in lib/, route handlers thin.
- Small diffs. No new dependencies without asking.
