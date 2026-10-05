'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Doc = { id: string; filename: string; status: string; chunk_count: number; error: string | null };

const BADGE: Record<string, string> = {
  ready: 'bg-green-100 text-green-800',
  processing: 'bg-yellow-100 text-yellow-800',
  failed: 'bg-red-100 text-red-800',
};

export function DocumentsPanel({ workspaceId }: { workspaceId: string }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/workspaces/${workspaceId}/documents`);
    if (res.ok) setDocs((await res.json()).documents);
  }, [workspaceId]);

  useEffect(() => {
    let alive = true;
    fetch(`/api/workspaces/${workspaceId}/documents`)
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => { if (alive && b) setDocs(b.documents); });
    return () => { alive = false; };
  }, [workspaceId]);

  async function upload(file: File) {
    setBusy(true);
    setNote('');
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`/api/workspaces/${workspaceId}/documents`, { method: 'POST', body: form });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (input.current) input.current.value = '';
    if (!res.ok) setNote(body.error ?? 'Upload failed');
    else if (body.duplicate) setNote('This file is already in the workspace — nothing was added.');
    await load();
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold">Documents</h2>
      <label className="mb-3 block">
        <span className="inline-block cursor-pointer rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700">
          {busy ? 'Processing…' : '+ Upload'}
        </span>
        <input ref={input} data-testid="file-input" type="file" accept=".pdf,.txt,.md" className="hidden" disabled={busy}
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </label>
      {note && <p className="mb-2 text-sm text-gray-600">{note}</p>}
      {docs.length === 0 ? (
        <p className="text-sm text-gray-500">No documents yet.</p>
      ) : (
        <ul className="space-y-2">
          {docs.map((d) => (
            <li key={d.id} className="rounded-md border border-gray-100 p-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{d.filename}</span>
                <span className={`rounded px-1.5 py-0.5 text-xs ${BADGE[d.status] ?? ''}`}>{d.status}</span>
              </div>
              <p className="text-xs text-gray-500">{d.status === 'failed' ? d.error : `${d.chunk_count} chunks`}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
