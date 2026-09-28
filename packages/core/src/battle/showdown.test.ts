import { describe, expect, it } from 'vitest';
import { BattleStream, Dex, getPlayerStreams, SHOWDOWN_FORMATS, Teams } from './showdown.js';

/** `|win|<name>` or `|tie` as a whole protocol line (note: `|tier|` must not match). */
const BATTLE_END = /^\|(win\||tie$)/m;

/** Plays a whole battle choosing `default` for every request. Returns the winner line. */
async function autoBattle(formatid: string, teamSize: number) {
  const streams = getPlayerStreams(new BattleStream());
  const team = () => {
    const generated = Teams.generate(SHOWDOWN_FORMATS.randomSets);
    return Teams.pack(generated.slice(0, teamSize).map((set) => ({ ...set, level: 50 })));
  };

  for (const side of [streams.p1, streams.p2]) {
    void (async () => {
      for await (const chunk of side) {
        if (chunk.includes('|request|') && !chunk.includes('"wait":true')) {
          void side.write('default');
        }
      }
    })();
  }

  const spectatorLog: string[] = [];
  const done = (async () => {
    for await (const chunk of streams.spectator) {
      spectatorLog.push(chunk);
      if (BATTLE_END.test(chunk)) return chunk;
    }
    return '';
  })();

  void streams.omniscient.write(`>start ${JSON.stringify({ formatid })}
>player p1 ${JSON.stringify({ name: 'Red', team: team() })}
>player p2 ${JSON.stringify({ name: 'Blue', team: team() })}`);

  const end = await done;
  return { end, spectatorLog: spectatorLog.join('\n') };
}

describe('Showdown simulator (Champions mod)', () => {
  it('exposes the formats Poke-Air relies on', () => {
    for (const id of Object.values(SHOWDOWN_FORMATS)) {
      const format = Dex.formats.get(id);
      expect(format.exists, id).toBe(true);
      expect(format.mod, id).toBe('champions');
    }
    expect(Dex.formats.get(SHOWDOWN_FORMATS.doubles).gameType).toBe('doubles');
  });

  it('ships Mega Stones in the Champions dex', () => {
    const dex = Dex.mod('champions');
    expect(dex.items.get('Charizardite X').megaStone).toBeTruthy();
  });

  it('plays a full singles battle to the end', async () => {
    const { end, spectatorLog } = await autoBattle(SHOWDOWN_FORMATS.singles, 3);
    expect(end).toMatch(BATTLE_END);
    // The spectator stream is what the Host renders: public info only.
    expect(spectatorLog).toContain('|switch|');
    expect(spectatorLog).not.toContain('|request|');
  }, 30_000);

  it('plays a full doubles battle to the end', async () => {
    const { end } = await autoBattle(SHOWDOWN_FORMATS.doubles, 4);
    expect(end).toMatch(BATTLE_END);
  }, 30_000);
});
