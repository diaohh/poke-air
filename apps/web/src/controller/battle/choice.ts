import {
  targetOptions,
  type BattleActiveOption,
  type BattleFieldSlot,
  type BattleMoveOption,
  type BattlePokemon,
  type BattleRequest,
  type SideId,
  type TargetOption,
} from '@poke-air/shared';

/**
 * A decision is one step per position the player decides (decision D-43): singles and most
 * doubles turns of a 2v2 have one step, a solo doubles player has two. Each step produces one
 * action; the last step sends them all, comma-separated.
 */
export interface DecisionStep {
  kind: 'move' | 'switch';
  position: number;
  /** The Pokémon in that position (acting, or being replaced). */
  pokemon: BattlePokemon | undefined;
  /** `move` steps: its moves, Mega and trapped flags. */
  option?: BattleActiveOption;
}

export function stepsOf(request: BattleRequest): DecisionStep[] {
  const find = (name: string) => request.pokemon.find((p) => p.name === name);
  if (request.kind === 'move') {
    return request.active.map((option) => ({
      kind: 'move',
      position: option.position,
      pokemon: find(option.pokemon),
      option,
    }));
  }
  if (request.kind === 'switch') {
    return request.forceSwitch.map((slot) => ({
      kind: 'switch',
      position: slot.position,
      pokemon: find(slot.pokemon),
    }));
  }
  return [];
}

export interface SwitchOption {
  pokemon: BattlePokemon;
  /** `switch N` value. */
  slot: number;
  allowed: boolean;
}

/** `switch N` slots already picked by the earlier steps of this decision. */
export function pickedSlots(actions: readonly string[]): number[] {
  return actions.flatMap((action) => {
    const match = /^switch (\d)$/.exec(action);
    return match ? [Number(match[1])] : [];
  });
}

/** The player's party with what can come in now (not active, fainted, trapped or already picked). */
export function switchOptions(
  request: BattleRequest,
  step: DecisionStep | undefined,
  actions: readonly string[] = [],
): SwitchOption[] {
  const trapped = step?.kind === 'move' && Boolean(step.option?.trapped);
  const picked = pickedSlots(actions);
  return request.pokemon.map((pokemon) => ({
    pokemon,
    slot: pokemon.slot,
    allowed:
      !pokemon.active &&
      !pokemon.fainted &&
      !trapped &&
      request.kind !== 'wait' &&
      !picked.includes(pokemon.slot),
  }));
}

/** Positions left → right as the TV shows them: the far side (p2) is mirrored (decision D-48). */
export function tvOrder(side: SideId, activePerSide: number): number[] {
  const positions = Array.from({ length: activePerSide }, (_, i) => i);
  return side === 'p2' ? positions.reverse() : positions;
}

export interface TargetChoice extends TargetOption {
  /** What stands there (public view), `null` when empty. */
  slot: BattleFieldSlot | null;
  /** The user itself (only for moves like Acupressure). */
  self: boolean;
}

/** Where `move` can be aimed from `position`, in TV order (foes first). Empty = no target step. */
export function targetChoices(
  request: BattleRequest,
  position: number,
  move: BattleMoveOption,
): TargetChoice[] {
  const foeSide: SideId = request.side === 'p1' ? 'p2' : 'p1';
  const options = targetOptions(move.target, position, request.activePerSide);
  const inOrder = (side: 'foe' | 'own') =>
    tvOrder(side === 'foe' ? foeSide : request.side, request.activePerSide).flatMap((p) =>
      options.filter((o) => o.side === side && o.position === p),
    );
  return [...inOrder('foe'), ...inOrder('own')].map((option) => ({
    ...option,
    slot: (option.side === 'foe' ? request.field.foe : request.field.own)[option.position] ?? null,
    self: option.side === 'own' && option.position === position,
  }));
}

/** `move N [target] [mega]`. */
export function moveAction(index: number, target: number | undefined, mega: boolean): string {
  return `move ${index + 1}${target === undefined ? '' : ` ${target}`}${mega ? ' mega' : ''}`;
}

export type ChoiceSummary =
  | { kind: 'move'; pokemon: string; move: string; mega: boolean; target?: string }
  | { kind: 'switch'; pokemon: string }
  | { kind: 'default' };

/** "move 2 1 mega, switch 3" / "default" → one line per action for the waiting view. */
export function summarize(request: BattleRequest, choice: string): ChoiceSummary[] {
  if (choice === 'default') return [{ kind: 'default' }];
  const steps = stepsOf(request);
  return choice.split(',').map((raw, k): ChoiceSummary => {
    const [kind, index, ...flags] = raw.trim().split(' ');
    const step = steps[k];
    if (kind === 'move' && step?.option) {
      const move = step.option.moves[Number(index) - 1];
      const loc = Number(flags.find((flag) => /^-?\d$/.test(flag)));
      const target = loc
        ? (loc > 0 ? request.field.foe[loc - 1] : request.field.own[-loc - 1])?.name
        : undefined;
      if (move) {
        return {
          kind: 'move',
          pokemon: step.option.pokemon,
          move: move.name,
          mega: flags.includes('mega'),
          ...(target ? { target } : {}),
        };
      }
    }
    if (kind === 'switch') {
      const pokemon = request.pokemon.find((p) => p.slot === Number(index));
      if (pokemon) return { kind: 'switch', pokemon: pokemon.name };
    }
    return { kind: 'default' };
  });
}
