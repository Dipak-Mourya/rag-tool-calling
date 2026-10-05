'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

type Source = { n: number; filename: string; page: number | null; snippet: string };
type Retrieved = { filename: string; page: number | null; similarity: number; used: boolean };
type Debug = { workspace_id?: string; retrieved?: Retrieved[]; latency_ms?: number; tokens?: number; steps?: number };
type Message = { id: string; role: 'user' | 'assistant'; content: string; status: string; sources: Source[]; debug: Debug | null };

type Props = {
  workspaceId: string;
  workspaceName: string;
  onDone: () => void;
  headerAction?: ReactNode;
};

export function ChatPanel({ workspaceId, workspaceName, onDone, headerAction }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const bottom = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/workspaces/${workspaceId}/chat`);
    if (res.ok) setMessages((await res.json()).messages);
  }, [workspaceId]);

  useEffect(() => {
    let alive = true;
    fetch(`/api/workspaces/${workspaceId}/chat`)
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => { if (alive && b) setMessages(b.messages); });
    return () => { alive = false; };
  }, [workspaceId]);

  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [messages, busy]);

  async function send(question: string) {
    if (!question.trim() || busy) return;
    setBusy(true);
    setError('');
    setText('');
    setMessages((m) => [...m, { id: 'tmp', role: 'user', content: question, status: 'done', sources: [], debug: null }]);
    const res = await fetch(`/api/workspaces/${workspaceId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) setError(body.error ?? 'Request failed');
    // "reset" wiped documents too; reload so every panel shows the empty workspace.
    if (body.reset) { window.location.reload(); return; }
    await load();
    setBusy(false);
    onDone();
  }

  return (
    <section className="flex min-h-[28rem] flex-col rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <h2 className="text-sm font-semibold">Chat — {workspaceName}</h2>
        {headerAction}
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4" data-testid="messages">
        {messages.length === 0 && <p className="text-sm text-gray-500">Upload documents, then ask questions about them.</p>}
        {messages.map((m, i) => (
          <div key={m.id + i} data-testid="msg" className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${m.role === 'user' ? 'bg-gray-900 text-white' : m.status === 'error' ? 'bg-red-50 text-red-800' : 'bg-gray-100'}`}>
              <p className="whitespace-pre-wrap">{m.status === 'pending' ? 'Thinking…' : m.content}</p>
              {m.status === 'error' && i > 0 && (
                <button className="mt-1 text-xs underline" onClick={() => send(messages[i - 1].content)}>Retry</button>
              )}
              {m.sources?.length > 0 && (
                <ul className="mt-2 space-y-0.5 border-t border-gray-200 pt-2 text-xs text-gray-600">
                  {m.sources.map((s) => (
                    <li key={s.n} title={s.snippet}>📄 [{s.n}] {s.filename} — p.{s.page ?? 1}</li>
                  ))}
                </ul>
              )}
              {m.role === 'assistant' && m.debug?.retrieved && (
                <div className="mt-1">
                  <button className="text-xs text-gray-500 underline" onClick={() => setOpen((o) => ({ ...o, [m.id]: !o[m.id] }))}>
                    {open[m.id] ? 'Hide retrieval' : 'Show retrieval'}
                  </button>
                  {open[m.id] && (
                    <div className="mt-1 rounded border border-gray-200 bg-white p-2 text-xs text-gray-600" data-testid="debug">
                      <p>workspace: {m.debug.workspace_id}</p>
                      <p>{m.debug.latency_ms} ms · {m.debug.tokens} tokens · {m.debug.steps} step(s)</p>
                      <ul className="mt-1">
                        {m.debug.retrieved.map((r, k) => (
                          <li key={k}>{r.used ? '✓' : '·'} {r.filename} p.{r.page ?? 1} — {r.similarity}</li>
                        ))}
                        {m.debug.retrieved.length === 0 && <li>no chunks in this workspace</li>}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && <p className="text-sm text-gray-500">Thinking…</p>}
        <div ref={bottom} />
      </div>
      {error && <p className="px-4 pb-1 text-sm text-red-600">{error}</p>}
      <form className="flex gap-2 border-t border-gray-100 p-3" onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <input
          className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
          placeholder="Ask about your documents…" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} disabled={busy}
        />
        <button disabled={busy || !text.trim()} className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50">
          Send
        </button>
      </form>
    </section>
  );
}
