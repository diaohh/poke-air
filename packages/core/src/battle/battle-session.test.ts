import type { PokemonSetData, SideId } from '@poke-air/shared';
import { describe, expect, it } from 'vitest';
import { BattleSession, spectatorLines, type BattleEnd } from './battle-session.js';
import type { RawRequest } from './request.js';
import { BATTLE_FORMAT_IDS } from './showdown.js';
import { GARCHOMP, MAGIKARP, PIKACHU, SEED } from '../testing/fixtures.js';

function createSession(teams: Record<SideId, PokemonSetData[]>) {
  const requests: { side: SideId; request: RawRequest; rqid: number }[] = [];
  const chunks: string[][] = [];
  const ends: BattleEnd[] = [];
  const session = new BattleSession({
    formatId: BATTLE_FORMAT_IDS.singles,
    seed: SEED,
    sides: { p1: { name: 'Ana', team: teams.p1 }, p2: { name: 'Ben', team: teams.p2 } },
    onSpectator: (lines) => chunks.push(lines),
    onRequest: (side, request, rqid) => requests.push({ side, request, rqid }),
    onEnd: (end) => ends.push(end),
  });
  session.start();
  const last = (side: SideId) => requests.filter((r) => r.side === side).at(-1);
  return { session, requests, chunks, ends, last };
}

describe('BattleSession', () => {
  it('starts with public HP percentages, no debug output and a move request per side', () => {
    const { session, last } = createSession({ p1: [GARCHOMP], p2: [MAGIKARP] });
    const log = session.spectatorLog.join('\n');
    expect(log).toMatch(/^\|switch\|p1a: Garchomp\|Garchomp, L50(, [MF])?\|100\/100$/m);
    expect(log).not.toContain('|debug|');
    expect(log).not.toContain('|split|');
    expect(last('p1')?.request.active?.[0]?.canMegaEvo).toBe(true);
    // Each side still sees its own exact HP in its request.
    expect(last('p1')?.request.side.pokemon[0]?.condition).toMatch(/^\d+\/\d+$/);
    expect(last('p1')?.request.side.pokemon[0]?.condition).not.toBe('100/100');
    expect(last('p2')?.request.wait).toBeUndefined();
  });

  it('rejects invalid choices synchronously and keeps the request', () => {
    const { session, requests } = createSession({ p1: [GARCHOMP], p2: [MAGIKARP] });
    const before = requests.length;
    expect(session.choose('p1', 'move 9')).toBe(false);
    expect(session.choose('p1', 'switch 2')).toBe(false);
    expect(requests).toHaveLength(before);
    expect(session.choose('p1', 'move 1')).toBe(true);
  });

  it('undoes a choice while the other side is still choosing', () => {
    const { session, chunks } = createSession({ p1: [GARCHOMP], p2: [MAGIKARP] });
    expect(session.choose('p1', 'move 3')).toBe(true);
    expect(session.undo('p1')).toBe(true);
    expect(session.choose('p1', 'move 1 mega')).toBe(true);
    expect(session.choose('p2', 'move 1')).toBe(true);
    const turn = chunks.at(-1)?.join('\n') ?? '';
    expect(turn).toContain('|detailschange|p1a: Garchomp|Garchomp-Mega');
    expect(turn).toContain('|move|p1a: Garchomp|Earthquake|');
  });

  it('asks for a forced switch after a faint, then plays on', () => {
    const { session, last } = createSession({ p1: [GARCHOMP], p2: [MAGIKARP, PIKACHU] });
    session.choose('p1', 'move 1');
    session.choose('p2', 'move 1');
    expect(session.spectatorLog.join('\n')).toContain('|faint|p2a: Magikarp');
    expect(last('p2')?.request.forceSwitch).toEqual([true]);
    expect(last('p1')?.request.wait).toBe(true);

    const rqid = last('p2')?.rqid;
    expect(session.choose('p2', 'switch 2')).toBe(true);
    expect(last('p2')?.rqid).not.toBe(rqid);
    expect(last('p1')?.request.active).toBeDefined();
    expect(session.turn).toBe(2);
  });

  it('ends normally when a side has no Pokémon left', () => {
    const { session, ends } = createSession({ p1: [GARCHOMP], p2: [MAGIKARP] });
    session.choose('p1', 'move 1');
    session.choose('p2', 'move 1');
    expect(ends).toEqual([{ winner: 'p1', reason: 'normal' }]);
    expect(session.ended).toBe(true);
    expect(session.summary()).toEqual({
      p1: { fainted: 0, remaining: 1, total: 1 },
      p2: { fainted: 1, remaining: 0, total: 1 },
    });
    expect(session.choose('p1', 'move 1')).toBe(false);
  });

  it('ends with a forfeit', () => {
    const { session, ends } = createSession({ p1: [GARCHOMP], p2: [MAGIKARP] });
    session.forfeit('p1');
    expect(ends).toEqual([{ winner: 'p2', reason: 'forfeit' }]);
    expect(session.spectatorLog.at(-1)).toBe('|win|Ben');
  });

  it('keeps the input log for deterministic replays', () => {
    const { session } = createSession({ p1: [GARCHOMP], p2: [MAGIKARP] });
    session.choose('p1', 'move 1');
    session.choose('p2', 'move 1');
    expect(session.inputLog[0]).toContain(SEED);
    expect(session.inputLog.slice(-2)).toEqual(['>p1 move earthquake', '>p2 move splash']);
  });
});

describe('spectatorLines', () => {
  it('keeps only the public half of |split| blocks', () => {
    const update = [
      '|move|p1a: A|Tackle|p2a: B',
      '|split|p2',
      '|-damage|p2a: B|40/120',
      '|-damage|p2a: B|34/100',
      '|turn|2',
    ].join('\n');
    expect(spectatorLines(update)).toEqual([
      '|move|p1a: A|Tackle|p2a: B',
      '|-damage|p2a: B|34/100',
      '|turn|2',
    ]);
  });
});
