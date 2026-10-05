'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function CreateWorkspaceForm({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(body.error ?? 'Could not create workspace');
    setName('');
    router.push(`/w/${body.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className={compact ? 'flex gap-2' : 'flex flex-col gap-3 sm:flex-row'}>
      <input
        className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-900"
        placeholder="New workspace name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={80}
        required
      />
      <button
        disabled={busy}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
      >
        {busy ? 'Creating…' : compact ? '+ New' : 'Create workspace'}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
