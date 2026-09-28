/**
 * Spike S1 helper: measures startup time and memory of the Showdown simulator with the Champions
 * mod, then plays N auto battles. Run: `pnpm --filter @poke-air/core sim:smoke [battles]`.
 * Results are recorded in docs/09-roadmap.md (S1) — re-run after upgrading pokemon-showdown.
 */
import {
  BattleStream,
  Dex,
  getPlayerStreams,
  SHOWDOWN_FORMATS,
  Teams,
} from '../src/battle/showdown.js';

/** `|win|<name>` or `|tie` as a whole protocol line (note: `|tier|` must not match). */
const BATTLE_END = /^\|(win\||tie$)/m;

const battles = Number(process.argv[2] ?? 20);
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(0)} MB`;
const memory = () => {
  const { rss, heapUsed } = process.memoryUsage();
  return `rss ${mb(rss)}, heap ${mb(heapUsed)}`;
};

console.log(`Baseline: ${memory()}`);

let t = performance.now();
Dex.mod('champions').includeData();
Teams.generate(SHOWDOWN_FORMATS.randomSets);
console.log(
  `Champions dex + random sets loaded in ${(performance.now() - t).toFixed(0)} ms: ${memory()}`,
);

async function play(formatid: string) {
  const streams = getPlayerStreams(new BattleStream());
  const team = () =>
    Teams.pack(Teams.generate(SHOWDOWN_FORMATS.randomSets).map((set) => ({ ...set, level: 50 })));
  for (const side of [streams.p1, streams.p2]) {
    void (async () => {
      for await (const chunk of side) {
        if (chunk.includes('|request|') && !chunk.includes('"wait":true'))
          void side.write('default');
      }
    })();
  }
  let turns = 0;
  const done = (async () => {
    for await (const chunk of streams.spectator) {
      turns += chunk.split('|turn|').length - 1;
      if (BATTLE_END.test(chunk)) return;
    }
  })();
  void streams.omniscient.write(`>start ${JSON.stringify({ formatid })}
>player p1 ${JSON.stringify({ name: 'Red', team: team() })}
>player p2 ${JSON.stringify({ name: 'Blue', team: team() })}`);
  await done;
  return turns;
}

for (const gameType of ['singles', 'doubles'] as const) {
  t = performance.now();
  let turns = 0;
  for (let i = 0; i < battles; i++) turns += await play(SHOWDOWN_FORMATS[gameType]);
  const elapsed = performance.now() - t;
  console.log(
    `${battles} ${gameType} battles: ${turns} turns, ${(elapsed / turns).toFixed(2)} ms/turn avg, ${memory()}`,
  );
}
