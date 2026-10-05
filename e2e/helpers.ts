import { expect, type Page } from '@playwright/test';

export const PASSWORD = 'Test-pass-123';

export async function signUp(page: Page, email: string) {
  await page.goto('/login');
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder(/Password/).fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('Your workspaces')).toBeVisible();
}

export async function createWorkspace(page: Page, name: string, compact = false) {
  const input = page.getByPlaceholder('New workspace name');
  await input.fill(name);
  await page.getByRole('button', { name: compact ? '+ New' : 'Create workspace' }).click();
  await expect(page).toHaveURL(/\/w\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name: `Chat — ${name}` })).toBeVisible();
}

export async function ask(page: Page, question: string) {
  await page.waitForTimeout(3_000);
  const input = page.getByPlaceholder('Ask about your documents…');
  await input.fill(question);
  const posted = page.waitForResponse((r) => r.url().endsWith('/chat') && r.request().method() === 'POST', { timeout: 90_000 });
  await page.getByRole('button', { name: 'Send' }).click();
  await posted;
  await expect(input).toBeEnabled({ timeout: 30_000 });
  return page.getByTestId('msg').last().innerText();
}

export async function uploadAndWait(page: Page, file: string, readyCount: number) {
  await page.getByTestId('file-input').setInputFiles(file);
  await expect(page.getByText('ready')).toHaveCount(readyCount, { timeout: 40_000 });
}
