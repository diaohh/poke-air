import type { EffectDuration } from '@poke-air/shared';
import { useTranslation } from 'react-i18next';
import { turnsLeft, type FieldEffect, type SceneState } from './model';

/**
 * Chip text for a field / side effect: "Rain · 1/4" (1 turn left of 4), "Spikes ×2" (hazard
 * layers) or just the name when nothing is known.
 */
export function useEffectLabel() {
  const { t } = useTranslation();
  return (
    name: string,
    effect: FieldEffect,
    scene: SceneState,
    duration: EffectDuration | undefined,
  ): string => {
    const turns = turnsLeft(effect, scene, duration);
    if (turns) {
      return t('host.battle.effectTurns', { effect: name, left: turns.left, total: turns.total });
    }
    if (effect.layers > 1) {
      return t('host.battle.effectLayers', { effect: name, layers: effect.layers });
    }
    return name;
  };
}
