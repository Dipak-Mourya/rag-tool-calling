import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { SignOutButton } from './components/sign-out-button';import { CreateWorkspaceForm } from './components/create-workspace-form';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name, created_at')
    .order('created_at');

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Document AI</h1>
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <span>{user?.email}</span>
          <SignOutButton />
        </div>
      </header>

      <h2 className="mb-3 text-sm font-medium text-gray-500">Your workspaces</h2>
      {workspaces && workspaces.length > 0 ? (
        <ul className="mb-8 grid gap-3 sm:grid-cols-2">
          {workspaces.map((w) => (
            <li key={w.id}>
              <Link
                href={`/w/${w.id}`}
                className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:border-gray-400"
              >
                <p className="font-medium">{w.name}</p>
                <p className="mt-1 text-xs text-gray-500">Created {new Date(w.created_at).toLocaleDateString()}</p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-8 rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
          No workspaces yet. Create your first one below.
        </p>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <CreateWorkspaceForm />
      </div>
    </div>
  );
}
