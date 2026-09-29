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

/** One Pokémon's block of a team text and the species its first line names. */
export interface TeamTextBlock {
  species: string;
  text: string;
}

/**
 * "Nickname (Species) (M) @ Item" / "Species (F) @ Item" / "Species" → the species. A best-effort
 * reading for previews: the server's parser (`team:import`) is the real one.
 */
export function teamTextSpecies(firstLine: string): string {
  const head = (firstLine.split(' @ ')[0] ?? '').trim().replace(/ \((M|F)\)$/, '');
  const nicknamed = /^.* \(([^()]+)\)$/.exec(head);
  return (nicknamed?.[1] ?? head).trim();
}

/**
 * Splits a Showdown team text into one block per Pokémon (blocks are separated by blank lines;
 * `=== [format] Name ===` headers are skipped). Lets the phone ask which Pokémon to keep when a
 * text has more than the slots available (decision D-54).
 */
export function splitTeamText(text: string): TeamTextBlock[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((block) =>
      block
        .split('\n')
        .filter((line) => line.trim() && !/^===.*===$/.test(line.trim()))
        .join('\n')
        .trim(),
    )
    .filter(Boolean)
    .map((block) => ({ species: teamTextSpecies(block.split('\n')[0] ?? ''), text: block }));
}
