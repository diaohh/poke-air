import { describe, expect, it } from 'vitest';
import { activePokemon, applyLine, initialScene, sceneFromLog, type SceneEvent } from './model';

/** Recorded from the simulator (Champions singles, public spectator stream). */
const LOG = [
  '|t:|1790566412',
  '|gametype|singles',
  '|player|p1|Ana||',
  '|player|p2|Ben||',
  '|gen|9',
  '|tier|[Gen 9 Champions] Custom Game',
  '|raw|<div class="infobox">custom rules</div>',
  '|',
  '|teamsize|p1|1',
  '|teamsize|p2|3',
  '|start',
  '|switch|p1a: Garchomp|Garchomp, L50, M|100/100',
  '|switch|p2a: Magikarp|Magikarp, L50, F|100/100',
  '|turn|1',
  '|',
  '|detailschange|p1a: Garchomp|Garchomp-Mega, L50, M',
  '|-mega|p1a: Garchomp|Garchomp|Garchompite',
  '|move|p1a: Garchomp|Swords Dance|p1a: Garchomp',
  '|-boost|p1a: Garchomp|atk|2',
  '|move|p2a: Magikarp|Splash|p2a: Magikarp',
  '|-nothing',
  '|upkeep',
  '|turn|2',
  '|move|p1a: Garchomp|Earthquake|p2a: Magikarp',
  '|-damage|p2a: Magikarp|0 fnt',
  '|faint|p2a: Magikarp',
  '|upkeep',
  '|switch|p2a: Gengar|Gengar, L50, M|100/100',
  '|turn|3',
  '|move|p2a: Gengar|Will-O-Wisp|p1a: Garchomp',
  '|-status|p1a: Garchomp|brn',
  '|move|p1a: Garchomp|Dragon Claw|p2a: Gengar',
  '|-supereffective|p2a: Gengar',
  '|-damage|p2a: Gengar|0 fnt',
  '|faint|p2a: Gengar',
  '|-damage|p1a: Garchomp|93/100 brn|[from] brn',
  '|upkeep',
];

function events(lines: string[]): SceneEvent[] {
  let state = initialScene();
  const out: SceneEvent[] = [];
  for (const line of lines) {
    const step = applyLine(state, line);
    state = step.state;
    if (step.event) out.push(step.event);
  }
  return out;
}

describe('HostBattleModel', () => {
  it('tracks players, team sizes, active Pokémon, Mega, boosts, status and faints', () => {
    const state = sceneFromLog(LOG);
    expect(state.sides.p1).toMatchObject({ name: 'Ana', teamSize: 1, active: ['Garchomp'] });
    expect(state.sides.p2).toMatchObject({ name: 'Ben', teamSize: 3, active: ['Gengar'] });
    expect(state.turn).toBe(3);

    const garchomp = activePokemon(state, 'p1');
    expect(garchomp).toMatchObject({
      species: 'Garchomp-Mega',
      mega: true,
      hp: 93,
      status: 'brn',
      boosts: { atk: 2 },
      gender: 'M',
      level: 50,
    });
    expect(state.sides.p2.pokemon.map((p) => [p.name, p.fainted])).toEqual([
      ['Magikarp', true],
      ['Gengar', true],
    ]);
  });

  it('emits animation events with narration for what matters', () => {
    const kinds = events(LOG).map((e) => e.kind);
    expect(kinds).toEqual([
      'switch',
      'switch',
      'turn',
      'mega',
      'move',
      'boost',
      'move',
      'turn',
      'move',
      'damage',
      'faint',
      'switch',
      'turn',
      'move',
      'status',
      'move',
      'message',
      'damage',
      'faint',
      'damage',
    ]);
    const narration = events(LOG).flatMap((e) => (e.narration ? [e.narration] : []));
    expect(narration).toContainEqual({
      key: 'sentOut',
      params: { trainer: 'Ben', pokemon: 'Gengar' },
    });
    expect(narration).toContainEqual({
      key: 'boost.2',
      params: { pokemon: 'Garchomp', stat: 'atk' },
    });
    expect(narration).toContainEqual({ key: 'hurtByStatus.brn', params: { pokemon: 'Garchomp' } });
    expect(narration).toContainEqual({ key: 'superEffective' });
  });

  it('points moves at their target side', () => {
    const move = events(LOG).find((e) => e.kind === 'move' && e.move === 'Earthquake');
    expect(move).toMatchObject({ side: 'p1', target: 'p2' });
  });

  it('handles weather, field and side conditions, and the end of the battle', () => {
    const state = sceneFromLog([
      '|-weather|RainDance',
      '|-weather|RainDance|[upkeep]',
      '|-fieldstart|move: Electric Terrain',
      '|-fieldstart|move: Trick Room',
      '|-sidestart|p2: Ben|move: Stealth Rock',
      '|-sidestart|p1: Ana|Reflect',
      '|-sideend|p1: Ana|Reflect',
      '|win|Ana',
    ]);
    expect(state).toMatchObject({
      weather: { name: 'RainDance' },
      terrain: { name: 'Electric Terrain' },
      field: [{ name: 'Trick Room' }],
      ended: true,
      winner: 'Ana',
    });
    expect(state.sides.p2.conditions.map((c) => c.name)).toEqual(['Stealth Rock']);
    expect(state.sides.p1.conditions).toEqual([]);

    const narration = events(['|-weather|RainDance', '|-weather|RainDance|[upkeep]', '|tie']);
    expect(narration.map((e) => e.narration?.key)).toEqual(['weather.RainDance', 'tie']);
  });

  it('ignores unknown or malformed lines', () => {
    const state = initialScene();
    expect(applyLine(state, '|-nothing').event).toBeNull();
    expect(applyLine(state, 'garbage').state).toBe(state);
    expect(applyLine(state, '|-damage|p9a: Nobody|50/100').event).toBeNull();
  });
});
