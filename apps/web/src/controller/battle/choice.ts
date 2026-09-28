import type { BattlePokemon, BattleRequest } from '@poke-air/shared';

export function activeOf(request: BattleRequest): BattlePokemon | undefined {
  return request.pokemon.find((p) => p.active);
}

export interface SwitchOption {
  pokemon: BattlePokemon;
  /** 1-based position for `switch N`. */
  slot: number;
  allowed: boolean;
}

/** Party with what can be switched in (not active, not fainted, not trapped). */
export function switchOptions(request: BattleRequest): SwitchOption[] {
  const trapped = request.kind === 'move' && Boolean(request.active[0]?.trapped);
  return request.pokemon.map((pokemon, i) => ({
    pokemon,
    slot: i + 1,
    allowed: !pokemon.active && !pokemon.fainted && !trapped && request.kind !== 'wait',
  }));
}

export type ChoiceSummary =
  | { kind: 'move'; pokemon: string; move: string; mega: boolean }
  | { kind: 'switch'; pokemon: string }
  | { kind: 'default' };

/** "move 2 mega" / "switch 3" / "default" → what the waiting view shows. */
export function summarize(request: BattleRequest, choice: string): ChoiceSummary {
  const [kind, index, flag] = choice.split(' ');
  const n = Number(index) - 1;
  if (kind === 'move') {
    const move = request.active[0]?.moves[n];
    const active = activeOf(request);
    if (move && active) {
      return { kind: 'move', pokemon: active.name, move: move.name, mega: flag === 'mega' };
    }
  }
  if (kind === 'switch') {
    const pokemon = request.pokemon[n];
    if (pokemon) return { kind: 'switch', pokemon: pokemon.name };
  }
  return { kind: 'default' };
}
