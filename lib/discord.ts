// Best-effort Discord notification: never throws, failures are only logged.
// The webhook URL is a secret, so it is never logged or returned.
export async function notifyDiscord(text: string): Promise<boolean> {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) {
    console.error('discord notify skipped: DISCORD_WEBHOOK_URL is not set');
    return false;
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // allowed_mentions: [] stops chat text from pinging @everyone.
      body: JSON.stringify({ content: text.slice(0, 1900), allowed_mentions: { parse: [] } }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error(`discord notify failed: HTTP ${res.status}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error('discord notify failed:', e instanceof Error ? e.message : 'unknown');
    return false;
  }
}
