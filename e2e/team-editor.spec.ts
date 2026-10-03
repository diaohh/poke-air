import { expect, test } from '@playwright/test';
import { closeContexts, openHost, phone, randomTeam } from './helpers';

test.afterEach(closeContexts);

/**
 * Phase 2: a phone edits a Pokémon of its random team (swaps a move) before getting ready; the
 * server validates and stores it, and the edit survives a refresh (rejoin with the saved seat).
 */
test('a phone changes a move of its Pokémon and keeps it after a refresh', async ({ browser }) => {
  const { host, code } = await openHost(browser);
  const ana = await phone(browser, code, 'Ana');
  await phone(browser, code, 'Ben');
  await host.getByRole('button', { name: 'Start game' }).click();
  await randomTeam(ana, 1);

  const card = ana.locator('article.phone-card');
  const before = await card.locator('.mon-card__move').allInnerTexts();
  await ana.getByRole('button', { name: /^Edit / }).click();
  await expect(ana.getByRole('heading', { name: 'Edit Pokémon' })).toBeVisible();

  // Replace the first move with the first other move the picker offers.
  const moves = ana.locator('section', { has: ana.getByRole('heading', { name: 'Moves' }) });
  await moves.locator('button.type-chip').first().click();
  await expect(ana.getByRole('searchbox')).toBeVisible();
  const options = ana.locator('button.picker-row:not([disabled])');
  const count = await options.count();
  let picked = '';
  for (let i = 0; i < count && !picked; i++) {
    const text = (await options.nth(i).locator('strong').innerText()).trim();
    if (text && !before.includes(text)) {
      await options.nth(i).click();
      picked = text;
    }
  }
  expect(picked).not.toBe('');
  await ana.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(ana.getByRole('heading', { name: 'Your team' })).toBeVisible();
  await expect(card.locator('.mon-card__move').first()).toHaveText(picked);
  await ana.reload();
  await expect(ana.locator('article.phone-card .mon-card__move').first()).toHaveText(picked);
  await ana.getByRole('button', { name: "I'm ready" }).click();
  await expect(host.getByText('1 / 2 ready').first()).toBeVisible();
});
