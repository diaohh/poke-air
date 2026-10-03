import { expect, test } from '@playwright/test';
import { closeContexts, openHost, phone, playToTheEnd, randomTeam, shot } from './helpers';

test.afterEach(closeContexts);

/**
 * Full Phase 1 flow: Host creates a room, two phones join and split into teams, build a random
 * one-Pokémon team each, ready up, play the battle to the end with their first usable move, then
 * the Host starts a rematch. `E2E_SCREENSHOTS=<dir>` saves screenshots of every screen.
 */
test('two phones play a singles battle to the end and start a rematch', async ({ browser }) => {
  const { host, code, errors } = await openHost(browser);
  await expect(host.getByText('Battle lobby')).toBeVisible();

  const ana = await phone(browser, code, 'Ana');
  const ben = await phone(browser, code, 'Ben');
  await shot(host, '01-host-lobby');
  await shot(ana, '02-phone-teams');

  await host.getByRole('button', { name: 'Start game' }).click();
  await shot(ana, '03-phone-team-builder');
  // Keep one Pokémon each so the battle is short.
  for (const page of [ana, ben]) await randomTeam(page, 1);
  await ana.getByRole('button', { name: "I'm ready" }).click();
  await expect(host.getByText('1 / 2 ready').first()).toBeVisible();
  await shot(host, '04-host-team-building');
  await ben.getByRole('button', { name: "I'm ready" }).click();
  await expect(host.getByText('Battle starts in')).toBeVisible();
  await shot(host, '05-host-countdown');

  // Battle: phones get their menu once the Host has shown the switch-ins.
  await expect(ana.getByRole('button', { name: 'FIGHT' })).toBeVisible({ timeout: 30_000 });
  const battleLog = host.getByRole('complementary', { name: 'Battle log' });
  await expect(battleLog).toContainText('sent out');
  await shot(host, '06-host-battle');
  await shot(ana, '07-phone-menu');
  await ana.getByRole('button', { name: 'FIGHT' }).click();
  await shot(ana, '08-phone-fight');
  await ana.getByRole('button', { name: 'Back' }).click();

  await playToTheEnd(host, [ana, ben]);

  await shot(host, '10-host-results');
  await expect(ana.getByRole('heading', { name: /Victory!|Defeat|It's a draw!/ })).toBeVisible();
  await shot(ana, '11-phone-results');

  await host.getByRole('button', { name: 'Rematch' }).click();
  await expect(ana.getByRole('heading', { name: 'Your team' })).toBeVisible();
  await expect(ana.locator('article.phone-card')).toHaveCount(1);
  expect(errors).toEqual([]);
});
