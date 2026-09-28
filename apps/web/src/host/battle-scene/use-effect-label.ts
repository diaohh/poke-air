import type { EffectDuration } from '@poke-air/shared';
import { useTranslation } from 'react-i18next';
import { turnsLeft, type FieldEffect, type SceneState } from './model';

/**
 * Chip text for a field / side effect: "Rain · 4", "Reflect · 3–6" (an unseen Light Clay may extend
 * it), "Spikes ×2" (hazard layers) or just the name when nothing is known.
 */
export function useEffectLabel() {
  const { t } = useTranslation();
  return (
    name: string,
    effect: FieldEffect,
    scene: SceneState,
    duration: EffectDuration | undefined,
  ): string => {
    const left = turnsLeft(effect, scene, duration);
    if (left) {
      const turns =
        left.min === left.max
          ? String(left.min)
          : t('host.battle.turnsRange', { min: left.min, max: left.max });
      return t('host.battle.effectTurns', { effect: name, turns });
    }
    if (effect.layers > 1) {
      return t('host.battle.effectLayers', { effect: name, layers: effect.layers });
    }
    return name;
  };
}
