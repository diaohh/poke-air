import { expect, test } from '@playwright/test';
import { closeContexts, openHost, phone, playToTheEnd, playTurn, randomTeam } from './helpers';

test.afterEach(closeContexts);

/**
 * Phase 4: the Host switches the room to Spanish in the lobby; the Host and the phones change
 * live, and the battle narration, the battle log and the results come out in Spanish.
 */
test('a room switched to Spanish plays its battle in Spanish', async ({ browser }) => {
  const { host, code, errors } = await openHost(browser, 'en-US');
  const ana = await phone(browser, code, 'Ana');
  const ben = await phone(browser, code, 'Ben');

  await host.getByRole('button', { name: 'Language: English' }).click();
  await host.getByRole('option', { name: 'Español' }).click();
  await expect(host.getByText('Sala de combate')).toBeVisible();
  await expect(ana.getByText('Elige tu equipo')).toBeVisible();

  await host.getByRole('button', { name: 'Empezar' }).click();
  for (const page of [ana, ben]) await randomTeam(page, 1);
  await expect(ana.getByRole('heading', { name: 'Tu equipo' })).toBeVisible();
  for (const page of [ana, ben]) await page.getByRole('button', { name: '¡Estoy listo!' }).click();
  await expect(host.getByText('El combate empieza en')).toBeVisible();

  await expect(ana.getByRole('button', { name: 'LUCHAR' })).toBeVisible({ timeout: 30_000 });
  const battleLog = host.getByRole('complementary', { name: 'Registro del combate' });
  await expect(battleLog).toContainText('saca a');
  await Promise.all([playTurn(ana), playTurn(ben)]);
  await expect(battleLog).toContainText('ha usado');

  await playToTheEnd(host, [ana, ben]);
  await expect(ana.getByRole('heading', { name: /¡Victoria!|Derrota|¡Empate!/ })).toBeVisible();
  expect(errors).toEqual([]);
});
