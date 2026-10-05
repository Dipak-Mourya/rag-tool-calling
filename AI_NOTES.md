# AI_NOTES (draft from the reference build — rewrite from the real session)

## Tools and split
Claude Code (Opus/Sonnet 5.x) for scaffolding, SQL drafts, route/UI boilerplate and Playwright tests. I chose the architecture (shared pgvector table, `match_chunks`, tool loop), reviewed diffs, and ran/verified everything in a browser.

## Key decisions
1. **Isolation inside the query:** one `document_chunks` table; `match_chunks(p_workspace_id, …)` filters in the vector search, plus membership check and RLS. `workspace_id` is never a model/tool argument.
2. **No ANN index at this scale:** an exact scan guarantees a full top-k after the workspace filter; HNSW post-filtering can return fewer than k for small workspaces.
3. **Tool loop:** model proposes → zod `.strict()` validation → run with server context → result back to the model; unknown tools and bad args become results, not crashes; max 4 steps; each call logged immediately.
4. **Chunking:** per page (page-level citations), ~1000 chars, 150 overlap.

## Hardest bug / wrong turn (practice run)
- `operator does not exist: extensions.vector <=> extensions.vector` — the AI's SQL set `search_path = public`; Supabase installs `vector` in `extensions`. Fixed with `search_path = public, extensions`.
- I chased "every Gemini model returns 404" for several minutes; the cause was my own zsh loop (`$m:generateContent` is a zsh modifier). Separately, a model that is listed can still 404 for new users, so test with a real call.

## With more time
Hybrid search (tsvector + vector, same workspace filter in both branches), streaming, async ingestion queue, paragraph-aware chunking, retrieval eval set, cross-workspace sharing opt-in.
