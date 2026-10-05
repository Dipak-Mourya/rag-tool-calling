#!/usr/bin/env bash
# Verifies .env.local WITHOUT printing any secret. Usage: bash scripts/check-env.sh
set -u
f="${1:-.env.local}"
get() { grep -E "^$1=" "$f" | head -1 | cut -d= -f2- | tr -d '\r'; }

for v in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY GEMINI_API_KEY GEMINI_CHAT_MODEL GEMINI_EMBED_MODEL; do
  [ -n "$(get $v)" ] && echo "set    $v" || echo "EMPTY  $v   <-- fix this"
done
[ -n "$(get DISCORD_WEBHOOK_URL)" ] && echo "set    DISCORD_WEBHOOK_URL" || echo "empty  DISCORD_WEBHOOK_URL (only needed for send_summary)"

URL=$(get NEXT_PUBLIC_SUPABASE_URL); PK=$(get NEXT_PUBLIC_SUPABASE_ANON_KEY); G=$(get GEMINI_API_KEY)
echo "supabase auth endpoint (want 200): $(curl -s -m 15 -o /dev/null -w '%{http_code}' -H "apikey: ${PK}" "${URL}/auth/v1/settings")"
echo "embedding model (want 200):        $(curl -s -m 30 -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' -d '{"content":{"parts":[{"text":"hi"}]},"outputDimensionality":768}' "https://generativelanguage.googleapis.com/v1beta/models/$(get GEMINI_EMBED_MODEL):embedContent?key=${G}")"

# Model lists lie: probe each chat model with a REAL generateContent call. Use ${m} braces (zsh!).
models="$(get GEMINI_CHAT_MODEL),$(get GEMINI_FALLBACK_MODELS)"
IFS=',' read -ra arr <<< "$models"
for m in "${arr[@]}"; do
  [ -z "$m" ] && continue
  printf "chat model %-28s " "$m"
  curl -s -m 60 -o /dev/null -w 'HTTP %{http_code} in %{time_total}s\n' -H 'Content-Type: application/json' \
    -d '{"contents":[{"role":"user","parts":[{"text":"Say hi"}]}],"generationConfig":{"thinkingConfig":{"thinkingLevel":"LOW"}}}' \
    "https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${G}"
done
echo "(HTTP 200 = usable, 429 = rate-limited right now, 404 = not available to this key, 503 = overloaded)"
