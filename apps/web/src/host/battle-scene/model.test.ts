import { describe, expect, it } from 'vitest';
import {
  activePokemon,
  applyLine,
  initialScene,
  sceneFromLog,
  turnsLeft,
  type SceneEvent,
} from './model';

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

describe('HostBattleModel · substitutes, protection and stat stages', () => {
  const START = [
    '|player|p1|Ana||',
    '|player|p2|Ben||',
    '|switch|p1a: Garchomp|Garchomp, L50, M|100/100',
    '|switch|p2a: Gengar|Gengar, L50, M|100/100',
    '|turn|1',
  ];

  it('puts up a Substitute, absorbs hits with it and clears it when it breaks', () => {
    const lines = [
      ...START,
      '|move|p1a: Garchomp|Substitute|p1a: Garchomp',
      '|-start|p1a: Garchomp|Substitute',
      '|-damage|p1a: Garchomp|75/100',
      '|move|p2a: Gengar|Shadow Ball|p1a: Garchomp',
      '|-activate|p1a: Garchomp|move: Substitute|[damage]',
      '|move|p2a: Gengar|Will-O-Wisp|p1a: Garchomp',
      '|-activate|p1a: Garchomp|move: Substitute|[block] Will-O-Wisp',
    ];
    const state = sceneFromLog(lines);
    expect(activePokemon(state, 'p1')).toMatchObject({ substitute: true, hp: 75 });
    const keys = events(lines).map((e) => [e.kind, e.narration?.key]);
    expect(keys).toContainEqual(['effect', 'substitute']);
    expect(keys).toContainEqual(['damage', 'substituteHit']);
    expect(keys.at(-1)).toEqual(['message', 'failed']);

    const broken = [...lines, '|-end|p1a: Garchomp|Substitute'];
    expect(activePokemon(sceneFromLog(broken), 'p1')?.substitute).toBe(false);
    expect(events(broken).at(-1)?.narration?.key).toBe('substituteEnd');
  });

  it('drops the Substitute on switch-out and on faint', () => {
    const withSub = [...START, '|-start|p1a: Garchomp|Substitute'];
    const switched = sceneFromLog([
      ...withSub,
      '|switch|p1a: Pikachu|Pikachu, L50, F|100/100',
      '|switch|p1a: Garchomp|Garchomp, L50, M|75/100',
    ]);
    expect(activePokemon(switched, 'p1')?.substitute).toBe(false);
    const fainted = sceneFromLog([...withSub, '|faint|p1a: Garchomp']);
    expect(fainted.sides.p1.pokemon[0]?.substitute).toBe(false);
  });

  it('narrates attacks blocked by Protect (`-block` from @pkmn/protocol)', () => {
    const blocked = events([
      ...START,
      '|move|p2a: Gengar|Protect|p2a: Gengar',
      '|-singleturn|p2a: Gengar|Protect',
      '|move|p1a: Garchomp|Earthquake|p2a: Gengar',
      '|-activate|p2a: Gengar|move: Protect',
    ]).at(-1);
    expect(blocked).toMatchObject({
      kind: 'effect',
      side: 'p2',
      narration: { key: 'protected', params: { pokemon: 'Gengar' } },
    });
  });

  it('carries the signed stage change on boost events and clamps stages to ±6', () => {
    const lines = [
      ...START,
      '|-boost|p1a: Garchomp|atk|2',
      '|-unboost|p1a: Garchomp|def|1',
      '|-boost|p1a: Garchomp|atk|6',
      '|-boost|p1a: Garchomp|spe|0',
    ];
    const boosts = events(lines).filter((e) => e.boost);
    expect(boosts.map((e) => e.boost)).toEqual([
      { stat: 'atk', amount: 2 },
      { stat: 'def', amount: -1 },
      { stat: 'atk', amount: 6 },
    ]);
    expect(boosts.map((e) => e.narration?.key)).toEqual(['boost.2', 'unboost.1', 'boost.3']);
    expect(activePokemon(sceneFromLog(lines), 'p1')?.boosts).toEqual({ atk: 6, def: -1, spe: 0 });
    // Switching out resets the stages.
    const back = sceneFromLog([
      ...lines,
      '|switch|p1a: Pikachu|Pikachu, L50, F|100/100',
      '|switch|p1a: Garchomp|Garchomp, L50, M|100/100',
    ]);
    expect(activePokemon(back, 'p1')?.boosts).toEqual({});
  });
});

describe('HostBattleModel · field effect durations', () => {
  it('counts an effect from the next turn when set before turn 1 or after upkeep', () => {
    const early = sceneFromLog(['|-weather|Sandstorm|[from] ability: Sand Stream', '|turn|1']);
    expect(early.weather).toMatchObject({ name: 'Sandstorm', since: 1 });

    const midTurn = sceneFromLog(['|turn|3', '|-sidestart|p1: Ana|Reflect']);
    expect(midTurn.sides.p1.conditions[0]).toMatchObject({ name: 'Reflect', since: 3 });

    const afterUpkeep = sceneFromLog(['|turn|3', '|upkeep', '|-fieldstart|move: Trick Room']);
    expect(afterUpkeep.field[0]).toMatchObject({ name: 'Trick Room', since: 4 });
  });

  it('stacks hazard layers', () => {
    const state = sceneFromLog([
      '|player|p2|Ben||',
      '|turn|1',
      '|-sidestart|p2: Ben|Spikes',
      '|-sidestart|p2: Ben|Spikes',
      '|-sidestart|p2: Ben|move: Toxic Spikes',
    ]);
    expect(state.sides.p2.conditions.map((c) => [c.name, c.layers])).toEqual([
      ['Spikes', 2],
      ['Toxic Spikes', 1],
    ]);
  });

  it('computes turns left out of the base duration, then of the item-extended one', () => {
    const reflect = { name: 'Reflect', since: 2, layers: 1 };
    const lightClay = { min: 5, max: 8 };
    expect(turnsLeft(reflect, { turn: 2, upkeep: false }, lightClay)).toEqual({
      left: 5,
      total: 5,
    });
    expect(turnsLeft(reflect, { turn: 2, upkeep: true }, lightClay)).toEqual({ left: 4, total: 5 });
    expect(turnsLeft(reflect, { turn: 6, upkeep: true }, lightClay)).toEqual({ left: 3, total: 8 });
    expect(turnsLeft(reflect, { turn: 9, upkeep: true }, lightClay)).toBeNull();
    expect(turnsLeft(reflect, { turn: 2, upkeep: false }, undefined)).toBeNull();
  });

  it('only narrates a weather when it starts, ends the terrain and keeps other field effects', () => {
    const lines = [
      '|-weather|Snowscape',
      '|-weather|Snowscape|[upkeep]',
      '|-weather|none',
      '|-fieldstart|move: Grassy Terrain',
      '|-fieldstart|move: Gravity',
      '|-fieldend|move: Grassy Terrain',
    ];
    const state = sceneFromLog(lines);
    expect(state).toMatchObject({ weather: null, terrain: null, field: [{ name: 'Gravity' }] });
    expect(events(lines).map((e) => e.narration?.key)).toEqual([
      'weather.Snow',
      'weatherEnd',
      'fieldStart',
      'fieldStart',
      'fieldEnd',
    ]);
  });
});

describe('HostBattleModel · doubles', () => {
  const DOUBLES = [
    '|gametype|doubles',
    '|player|p1|Ana & Cleo||',
    '|player|p2|Ben & Dan||',
    '|switch|p1a: Garchomp|Garchomp, L50, M|100/100',
    '|switch|p1b: Pikachu|Pikachu, L50, F|100/100',
    '|switch|p2a: Magikarp|Magikarp, L50, F|100/100',
    '|switch|p2b: Feebas|Feebas, L50, F|100/100',
    '|turn|1',
  ];

  it('tracks two positions per side and the slot each event happens to', () => {
    const state = sceneFromLog(DOUBLES);
    expect(state.activePerSide).toBe(2);
    expect(state.sides.p1.active).toEqual(['Garchomp', 'Pikachu']);
    expect(activePokemon(state, 'p2', 1)?.name).toBe('Feebas');

    const [thunderbolt, damage] = events([
      ...DOUBLES,
      '|move|p1b: Pikachu|Thunderbolt|p2b: Feebas',
      '|-damage|p2b: Feebas|0 fnt',
    ]).slice(-2);
    expect(thunderbolt).toMatchObject({ side: 'p1', position: 1, target: 'p2', targetPosition: 1 });
    expect(damage).toMatchObject({ kind: 'damage', side: 'p2', position: 1 });
  });

  it('aims a spread move at its first target and swaps slots on Ally Switch', () => {
    const spread = events([
      ...DOUBLES,
      '|move|p1a: Garchomp|Earthquake|p2a: Magikarp|[spread] p2a,p2b,p1b',
    ]).at(-1);
    expect(spread).toMatchObject({ kind: 'move', target: 'p2', targetPosition: 0 });

    const lines = [...DOUBLES, '|swap|p1a: Garchomp|1|[from] move: Ally Switch'];
    expect(sceneFromLog(lines).sides.p1.active).toEqual(['Pikachu', 'Garchomp']);
    expect(events(lines).at(-1)).toMatchObject({
      kind: 'effect',
      side: 'p1',
      position: 1,
      narration: { key: 'swapped', params: { pokemon: 'Garchomp' } },
    });
  });
});
