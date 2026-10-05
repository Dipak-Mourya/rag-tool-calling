import { test, expect } from '@playwright/test';
import { signUp, createWorkspace } from './helpers';

test('create, switch and isolate workspaces', async ({ browser }) => {
  const stamp = Date.now();
  const a = await (await browser.newContext()).newPage();
  await signUp(a, `pw-a-${stamp}@example.com`);
  await expect(a.getByText('No workspaces yet')).toBeVisible();

  await createWorkspace(a, 'Ferrari');
  const ferrariUrl = a.url();
  await createWorkspace(a, 'Toyota', true);

  await a.getByLabel('Switch workspace').selectOption({ label: 'Ferrari' });
  await expect(a.getByRole('heading', { name: 'Chat — Ferrari' })).toBeVisible();
  expect(a.url()).toBe(ferrariUrl);

  // A different user must not see or open Ferrari.
  const b = await (await browser.newContext()).newPage();
  await signUp(b, `pw-b-${stamp}@example.com`);
  await expect(b.getByText('No workspaces yet')).toBeVisible();
  await b.goto(ferrariUrl);
  await expect(b.getByText('This page could not be found')).toBeVisible();

  // Logged-out visitors go to /login.
  const anon = await (await browser.newContext()).newPage();
  await anon.goto(ferrariUrl);
  await expect(anon).toHaveURL(/\/login/);
});
