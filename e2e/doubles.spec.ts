import { expect, test } from '@playwright/test';
import { closeContexts, openHost, phone, playToTheEnd, randomTeam, shot } from './helpers';

test.afterEach(closeContexts);

/**
 * Doubles 2v2 (Phase 3): four phones, each controlling only its own Pokémon, with target selection
 * and forced switches handed to the owner (or the ally), played to the results.
 */
test('four phones play a 2v2 doubles battle to the end', async ({ browser }) => {
  const { host, code, errors } = await openHost(browser);
  await host.getByRole('radio', { name: /Doubles/ }).click();
  await expect(host.getByRole('radio', { name: /Doubles/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );

  // Join order alternates teams: Ana and Cleo red, Ben and Dan blue.
  const phones = [];
  for (const name of ['Ana', 'Ben', 'Cleo', 'Dan']) phones.push(await phone(browser, code, name));
  await expect(host.getByRole('status')).toContainText('2v2');
  await host.getByRole('button', { name: 'Start game' }).click();

  // Two Pokémon each: a side has four, so faints hand the holes over between teammates.
  for (const page of phones) await randomTeam(page, 2);
  for (const page of phones) await page.getByRole('button', { name: "I'm ready" }).click();
  await expect(host.getByText('Battle starts in')).toBeVisible();

  const [ana] = phones;
  if (!ana) throw new Error('no phones');
  await expect(ana.getByRole('button', { name: 'FIGHT' })).toBeVisible({ timeout: 30_000 });
  // Each phone controls exactly one position: no "1 / 2" step counter.
  await expect(ana.getByText('1 / 2')).toHaveCount(0);
  await shot(host, 'doubles-01-host');
  await shot(ana, 'doubles-02-phone');

  await playToTheEnd(host, phones, 360_000);
  await shot(host, 'doubles-03-results');
  for (const page of phones) {
    await expect(page.getByRole('heading', { name: /Victory!|Defeat|It's a draw!/ })).toBeVisible();
  }
  expect(errors).toEqual([]);
});
