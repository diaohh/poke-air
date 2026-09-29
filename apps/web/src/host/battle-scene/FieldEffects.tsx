import { SIDE_IDS, type SideId } from '@poke-air/shared';
import type { CSSProperties } from 'react';
import { cn } from '../../lib/cn';
import type { SlotBox } from './ActiveSlot';
import { weatherId, type FieldEffect, type SceneState } from './model';

/**
 * Field effects drawn on the battle field (decision D-55), Showdown-style but with our own CSS
 * (`.fx-*` in styles/screens/_battle.scss; nothing from pokemon-showdown-client):
 * - `ground` (under the Pokémon): terrain tint, Trick Room grid, entry hazards on each side's ground,
 * - `air` (over the Pokémon, under the cards): weather, screens and Tailwind in front of each side.
 * Purely decorative: the chips / tags with turns left stay the readable source.
 */

type WeatherKind = 'rain' | 'heavy-rain' | 'sun' | 'harsh-sun' | 'sand' | 'snow' | 'wind';
const WEATHER_KINDS: Record<string, WeatherKind> = {
  RainDance: 'rain',
  PrimordialSea: 'heavy-rain',
  SunnyDay: 'sun',
  DesolateLand: 'harsh-sun',
  Sandstorm: 'sand',
  Snow: 'snow',
  Hail: 'snow',
  DeltaStream: 'wind',
};
const TERRAINS: Record<string, string> = {
  'Electric Terrain': 'electric',
  'Grassy Terrain': 'grassy',
  'Misty Terrain': 'misty',
  'Psychic Terrain': 'psychic',
};
const SCREENS: Record<string, string> = {
  Reflect: 'reflect',
  'Light Screen': 'light-screen',
  'Aurora Veil': 'aurora-veil',
};
const HAZARDS: Record<string, { kind: string; perLayer: number }> = {
  'Stealth Rock': { kind: 'rock', perLayer: 4 },
  Spikes: { kind: 'spike', perLayer: 3 },
  'Toxic Spikes': { kind: 'toxic', perLayer: 3 },
  'Sticky Web': { kind: 'web', perLayer: 1 },
};

/** The box around a side's slots (field px). */
function areaOf(boxes: readonly SlotBox[]): SlotBox {
  const left = Math.min(...boxes.map((b) => b.left));
  const top = Math.min(...boxes.map((b) => b.top));
  const right = Math.max(...boxes.map((b) => b.left + b.width));
  const bottom = Math.max(...boxes.map((b) => b.top + b.height));
  return { left, top, width: right - left, height: bottom - top };
}

interface Props {
  layer: 'ground' | 'air';
  scene: SceneState;
  slots: Record<SideId, SlotBox[]>;
}

export function FieldEffects({ layer, scene, slots }: Props) {
  if (layer === 'ground') {
    const terrain = scene.terrain ? TERRAINS[scene.terrain.name] : undefined;
    const trickRoom = scene.field.some((effect) => effect.name === 'Trick Room');
    return (
      <>
        {terrain && <div aria-hidden="true" className={`fx-terrain fx-terrain--${terrain}`} />}
        {trickRoom && <div aria-hidden="true" className="fx-room" />}
        {SIDE_IDS.map((side) => (
          <Hazards
            key={side}
            conditions={scene.sides[side].conditions}
            area={areaOf(slots[side])}
          />
        ))}
      </>
    );
  }

  const id = scene.weather ? weatherId(scene.weather.name) : null;
  const weather = id ? WEATHER_KINDS[id] : undefined;
  return (
    <>
      {SIDE_IDS.map((side) => (
        <Screens key={side} conditions={scene.sides[side].conditions} area={areaOf(slots[side])} />
      ))}
      {weather && <div aria-hidden="true" className={`fx-weather fx-weather--${weather}`} />}
    </>
  );
}

/** Reflect / Light Screen / Aurora Veil as translucent walls in front of the side; Tailwind streaks. */
function Screens({ conditions, area }: { conditions: FieldEffect[]; area: SlotBox }) {
  const screens = conditions.flatMap((c) => (SCREENS[c.name] ? [SCREENS[c.name]] : []));
  const tailwind = conditions.some((c) => c.name === 'Tailwind');
  return (
    <>
      {screens.map((kind, i) => (
        <div
          key={kind}
          aria-hidden="true"
          className={cn('fx-screen', `fx-screen--${kind}`)}
          style={{
            left: area.left + 20 + i * 16,
            top: area.top + 10 + i * 12,
            width: area.width - 40,
            height: area.height - 60,
          }}
        />
      ))}
      {tailwind && (
        <div
          aria-hidden="true"
          className="fx-tailwind"
          style={{ left: area.left, top: area.top, width: area.width, height: area.height - 40 }}
        />
      )}
    </>
  );
}

/** Stealth Rock, Spikes ×1–3, Toxic Spikes ×1–2 and Sticky Web on the side's ground. */
function Hazards({ conditions, area }: { conditions: FieldEffect[]; area: SlotBox }) {
  const pieces: { kind: string; key: string; style: CSSProperties }[] = [];
  const groundY = area.top + area.height - 70;
  for (const [row, condition] of conditions.filter((c) => HAZARDS[c.name]).entries()) {
    const hazard = HAZARDS[condition.name];
    if (!hazard) continue;
    if (hazard.kind === 'web') {
      pieces.push({
        kind: 'web',
        key: 'web',
        style: {
          left: area.left + area.width / 2 - 90,
          top: groundY - 50,
          width: 180,
          height: 110,
        },
      });
      continue;
    }
    const count = hazard.perLayer * Math.max(1, condition.layers);
    for (let i = 0; i < count; i++) {
      // Spread across the side's ground, alternating a little up / down so they don't line up.
      const x = area.left + 40 + ((i + 0.5) / count) * (area.width - 80);
      const y = groundY + (i % 2 === 0 ? -8 : 10) + row * 6;
      pieces.push({ kind: hazard.kind, key: `${hazard.kind}-${i}`, style: { left: x, top: y } });
    }
  }
  return (
    <>
      {pieces.map((piece) => (
        <span
          key={piece.key}
          aria-hidden="true"
          className={`fx-hazard fx-hazard--${piece.kind}`}
          style={piece.style}
        />
      ))}
    </>
  );
}
