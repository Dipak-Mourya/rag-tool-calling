import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/auth';
import { SignOutButton } from '@/app/components/sign-out-button';import { WorkspaceSwitcher } from '@/app/components/workspace-switcher';
import { DocumentsPanel } from '@/app/components/documents-panel';
import { ChatAndTools } from '@/app/components/chat-and-tools';
import { CreateWorkspaceForm } from '@/app/components/create-workspace-form';

export default async function WorkspacePage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  if (!isUuid(workspaceId)) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // RLS only returns workspaces the user is a member of, so a foreign id simply isn't found.
  const { data: workspaces } = await supabase.from('workspaces').select('id, name').order('created_at');
  const active = workspaces?.find((w) => w.id === workspaceId);
  if (!active || !workspaces) notFound();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-semibold">Document AI</Link>
          <WorkspaceSwitcher workspaces={workspaces} activeId={active.id} />
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <div className="w-72 max-w-full"><CreateWorkspaceForm compact /></div>
          <span className="hidden sm:inline">{user?.email}</span>
          <SignOutButton />
        </div>
      </header>

      <main className="grid flex-1 gap-4 p-4 lg:grid-cols-[18rem_1fr_18rem]">
        <DocumentsPanel workspaceId={active.id} />
        <ChatAndTools workspaceId={active.id} workspaceName={active.name} />
      </main>
    </div>
  );
}
