import * as ShowdownModule from 'pokemon-showdown';

/**
 * Single entry point to the Pokémon Showdown simulator. ALWAYS import Showdown through this module.
 *
 * `pokemon-showdown` is CommonJS: native Node ESM only exposes `module.exports` as `default`
 * (named imports fail at runtime), while bundlers (tsx/esbuild/Vite) expose named exports.
 * This adapter works in both.
 */
type ShowdownExports = typeof ShowdownModule;
const loaded = ShowdownModule as ShowdownExports & { default?: ShowdownExports };

export const Showdown: ShowdownExports = loaded.default ?? loaded;
export const { Battle, Dex, BattleStream, getPlayerStreams, Teams, TeamValidator, toID } = Showdown;

export type ShowdownBattle = InstanceType<typeof Battle>;
export type ShowdownSet = ReturnType<typeof Teams.generate>[number];
export type ShowdownDex = ReturnType<typeof Dex.mod>;

/** Every Poke-Air battle runs on the Champions mod (docs/05-game-rules-and-mechanics.md). */
export const CHAMPIONS_MOD = 'champions';

let championsDex: ShowdownDex | undefined;
/** The Champions dex, loaded on first use (~400 ms). */
export function getChampionsDex(): ShowdownDex {
  championsDex ??= Dex.mod(CHAMPIONS_MOD);
  return championsDex;
}

/**
 * Showdown format IDs used by Poke-Air (verified against pokemon-showdown 0.11.11).
 * The v1 "Casual" ruleset is built on top of the Champions custom games (docs/05-game-rules-and-mechanics.md).
 */
export const SHOWDOWN_FORMATS = {
  singles: 'gen9championscustomgame',
  doubles: 'gen9championsdoublescustomgame',
  /** Source of "meta" random sets for the randomizer (Champions sets; singles-oriented). */
  randomSets: 'gen9championsrandombattle',
  /**
   * Casual ruleset validator, used per set (spike S3): Champions NatDex Draft (NatDex learnsets for
   * every species) minus its competitive clauses, plus Z-Move Clause (Mega Evolution only).
   */
  validator:
    'gen9championsnatdexdraft@@@!Nickname Clause, !OHKO Clause, !Evasion Clause, !Sleep Clause Mod, Z-Move Clause',
} as const;

/**
 * Format ids battles actually start with. Champions custom games enable Team Preview, which v1 has
 * no phase for (decision D-20). `+Past` lets a Mega that needs a move instead of a Mega Stone
 * (Rayquaza knowing Dragon Ascent) Mega Evolve: the sim only allows it with that tag in Gen 9
 * (decision D-41). Custom rules are comma-separated with no spaces (`Battle` doesn't trim them).
 */
const BATTLE_RULES = '@@@!Team Preview,+Past';
export const BATTLE_FORMAT_IDS = {
  singles: `${SHOWDOWN_FORMATS.singles}${BATTLE_RULES}`,
  doubles: `${SHOWDOWN_FORMATS.doubles}${BATTLE_RULES}`,
} as const;
