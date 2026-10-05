'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(mode: 'signin' | 'signup') {
    setBusy(true);
    setMessage('');
    const supabase = createClient();
    const { data, error } =
      mode === 'signup'
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setMessage(error.message);
    if (!data.session) return setMessage('Account created, but email confirmation is on. Turn it off in Supabase.');
    router.push('/');
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Document AI</h1>
        <p className="mb-5 mt-1 text-sm text-gray-500">Sign in to your workspaces</p>
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); submit('signin'); }}>
          <input className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
            type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
            type="password" placeholder="Password (min 6 characters)" required minLength={6}
            value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className="rounded-md bg-gray-900 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50" disabled={busy}>
            Log in
          </button>
          <button type="button" disabled={busy} onClick={() => submit('signup')}
            className="rounded-md border border-gray-300 py-2 text-sm hover:bg-gray-50 disabled:opacity-50">
            Create account
          </button>
        </form>
        {message && <p className="mt-3 text-sm text-red-600">{message}</p>}
      </div>
    </main>
  );
}
