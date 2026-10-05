import { test, expect } from '@playwright/test';
import path from 'node:path';
import { signUp, createWorkspace } from './helpers';

const sample = (f: string) => path.join(__dirname, '..', 'samples', f);

test('ingests documents idempotently and rejects bad files', async ({ page }) => {
  await signUp(page, `pw-ing-${Date.now()}@example.com`);
  await createWorkspace(page, 'Ferrari');
  const input = page.getByTestId('file-input');

  await input.setInputFiles(sample('ferrari_requirements.md'));
  await expect(page.getByText('ferrari_requirements.md')).toBeVisible();
  await expect(page.getByText('ready')).toBeVisible({ timeout: 30_000 });
  const chunkText = await page.getByText(/\d+ chunks/).first().innerText();

  await input.setInputFiles(sample('ferrari_contract.md'));
  await expect(page.getByText('ferrari_contract.md')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('ready')).toHaveCount(2, { timeout: 30_000 });

  // Re-upload the same file: no new row, same chunk count.
  await input.setInputFiles(sample('ferrari_requirements.md'));
  await expect(page.getByText(/already in the workspace/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('ferrari_requirements.md')).toHaveCount(1);
  await expect(page.getByText(chunkText).first()).toBeVisible();

  // Disallowed type is rejected before any processing.
  await input.setInputFiles({ name: 'evil.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('MZ') });
  await expect(page.getByText(/Only \.pdf, \.txt and \.md/)).toBeVisible();

  // The list survives a reload (it is stored, not in memory).
  await page.reload();
  await expect(page.getByText('ready')).toHaveCount(2);
});

test('ingests a multi-page PDF', async ({ page, browser }) => {
  const maker = await (await browser.newContext()).newPage();
  await maker.setContent(
    '<h1>Page one</h1><p>The vendor onboarding checklist has twelve steps for new suppliers.</p>' +
    '<div style="page-break-before:always"></div><h1>Page two</h1><p>Escalation contacts are listed in appendix B of this handbook.</p>',
  );
  const pdf = await maker.pdf();

  await signUp(page, `pw-pdf-${Date.now()}@example.com`);
  await createWorkspace(page, 'PDF test');
  await page.getByTestId('file-input').setInputFiles({ name: 'handbook.pdf', mimeType: 'application/pdf', buffer: pdf });
  await expect(page.getByText('ready')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/\d+ chunks/)).toBeVisible();
});
