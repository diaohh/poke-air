import type {
  BattleMoveOption,
  BattlePokemon,
  BattleRequest,
  MoveCategory,
  MoveMeta,
  SideId,
  StatusId,
} from '@poke-air/shared';
import { getChampionsDex } from './showdown.js';

/**
 * Raw `|request|` JSON as the simulator sends it (subset we read; verified against
 * pokemon-showdown 0.11.11, see docs/05-game-rules-and-mechanics.md).
 */
export interface RawMoveSlot {
  move: string;
  id: string;
  pp?: number;
  maxpp?: number;
  target?: string;
  disabled?: boolean | string;
}

export interface RawActive {
  moves: RawMoveSlot[];
  canMegaEvo?: boolean;
  trapped?: boolean;
  maybeTrapped?: boolean;
}

export interface RawSidePokemon {
  ident: string;
  details: string;
  condition: string;
  active: boolean;
  moves: string[];
  baseAbility: string;
  ability?: string;
  item: string;
}

export interface RawRequest {
  wait?: boolean;
  teamPreview?: boolean;
  forceSwitch?: boolean[];
  active?: RawActive[];
  /** Re-sent request after hidden info was revealed (`[Unavailable choice]`) or an undo. */
  update?: boolean;
  side: { name: string; id: SideId; pokemon: RawSidePokemon[] };
}

const STATUSES = new Set<string>(['brn', 'par', 'psn', 'tox', 'slp', 'frz']);

/** Public move metadata from the Champions dex (unknown moves fall back to a typeless status). */
export function moveMeta(nameOrId: string): MoveMeta {
  const move = getChampionsDex().moves.get(nameOrId);
  if (!move.exists) return { type: 'Normal', category: 'Status' };
  return { type: move.type, category: move.category as MoveCategory };
}

/** Maps a raw sim request to the phone's model, adding move metadata (decision D-22). */
export function enrichRequest(raw: RawRequest, rqid: number): BattleRequest {
  const dex = getChampionsDex();
  const kind = raw.wait ? 'wait' : raw.forceSwitch ? 'switch' : 'move';

  const toOption = (slot: RawMoveSlot): BattleMoveOption => {
    const move = dex.moves.get(slot.id || slot.move);
    return {
      id: move.exists ? move.id : slot.id,
      name: slot.move,
      type: move.exists ? move.type : 'Normal',
      category: (move.exists ? move.category : 'Status') as MoveCategory,
      basePower: move.exists ? move.basePower : 0,
      accuracy: move.exists ? move.accuracy : true,
      pp: slot.pp ?? 0,
      maxpp: slot.maxpp ?? 0,
      target: slot.target ?? move.target,
      disabled: Boolean(slot.disabled),
      description: move.exists ? move.shortDesc || move.desc : '',
    };
  };

  return {
    kind,
    rqid,
    side: raw.side.id,
    active:
      kind === 'move'
        ? (raw.active ?? []).map((active) => ({
            moves: active.moves.map(toOption),
            canMegaEvo: Boolean(active.canMegaEvo),
            trapped: Boolean(active.trapped),
          }))
        : [],
    forceSwitch: kind === 'switch' ? (raw.forceSwitch ?? []) : [],
    pokemon: raw.side.pokemon.map(toPokemon),
  };
}

function toPokemon(raw: RawSidePokemon): BattlePokemon {
  const dex = getChampionsDex();
  const { species, level, gender, shiny } = parseDetails(raw.details);
  const { hp, maxhp, status, fainted } = parseCondition(raw.condition);
  const pokemon: BattlePokemon = {
    ident: raw.ident,
    name: raw.ident.replace(/^p\d[a-z]?: /, ''),
    species,
    level,
    hp,
    maxhp,
    fainted,
    active: raw.active,
    item: raw.item ? dex.items.get(raw.item).name || raw.item : '',
    ability: dex.abilities.get(raw.ability || raw.baseAbility).name || raw.baseAbility,
    moves: raw.moves.map((id) => {
      const move = dex.moves.get(id);
      return { id, name: move.exists ? move.name : id, type: move.exists ? move.type : 'Normal' };
    }),
  };
  if (gender) pokemon.gender = gender;
  if (shiny) pokemon.shiny = true;
  if (status) pokemon.status = status;
  return pokemon;
}

/** "Garchomp-Mega, L50, M, shiny" → parts. Level defaults to 100 when omitted (sim convention). */
export function parseDetails(details: string) {
  const [species = '', ...rest] = details.split(', ');
  let level = 100;
  let gender: string | undefined;
  let shiny = false;
  for (const part of rest) {
    if (/^L\d+$/.test(part)) level = Number(part.slice(1));
    else if (part === 'M' || part === 'F') gender = part;
    else if (part === 'shiny') shiny = true;
  }
  return { species, level, gender, shiny };
}

/** "63/166 par" · "0 fnt" → HP numbers, status and fainted flag. */
export function parseCondition(condition: string) {
  const [hpPart = '0', statusPart] = condition.split(' ');
  const [hp = 0, maxhp = 0] = hpPart.split('/').map(Number);
  const fainted = statusPart === 'fnt' || hp === 0;
  const status = statusPart && STATUSES.has(statusPart) ? (statusPart as StatusId) : undefined;
  return { hp, maxhp: maxhp || hp, status, fainted };
}
