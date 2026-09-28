import { STAT_IDS, type PokemonSetData, type StatId } from './team.js';

/**
 * Showdown's team text format ("export"), the interchange format players paste between tools.
 * Pure formatting: importing needs the dex, so it happens on the server (`team:import`).
 */

const STAT_LABELS: Record<StatId, string> = {
  hp: 'HP',
  atk: 'Atk',
  def: 'Def',
  spa: 'SpA',
  spd: 'SpD',
  spe: 'Spe',
};

/** One set as Showdown text. Stat Points go in the `EVs:` line (Champions reads SP from `evs`). */
export function formatSetText(set: PokemonSetData): string {
  const head = set.name && set.name !== set.species ? `${set.name} (${set.species})` : set.species;
  const gender = set.gender === 'M' || set.gender === 'F' ? ` (${set.gender})` : '';
  const lines = [`${head}${gender}${set.item ? ` @ ${set.item}` : ''}`];
  if (set.ability) lines.push(`Ability: ${set.ability}`);
  lines.push(`Level: ${set.level}`);
  const evs = STAT_IDS.filter((stat) => set.evs[stat] > 0).map(
    (stat) => `${set.evs[stat]} ${STAT_LABELS[stat]}`,
  );
  if (evs.length > 0) lines.push(`EVs: ${evs.join(' / ')}`);
  if (set.nature) lines.push(`${set.nature} Nature`);
  for (const move of set.moves) lines.push(`- ${move}`);
  return lines.join('\n');
}

/** A whole team, sets separated by a blank line. */
export function formatTeamText(sets: readonly PokemonSetData[]): string {
  return `${sets.map(formatSetText).join('\n\n')}\n`;
}
