import type { EffectDuration } from '@poke-air/shared';
import { useTranslation } from 'react-i18next';
import { useDexNames } from '../../lib/dex-names';
import { turnsLeft, type FieldEffect, type SceneState } from './model';

/**
 * Chip text for a field / side effect: "Rain · 1/4" (1 turn left of 4), "Spikes ×2" (hazard
 * layers) or just the name when nothing is known.
 */
export function useEffectLabel() {
  const { t } = useTranslation();
  const names = useDexNames();
  return (
    rawName: string,
    effect: FieldEffect,
    scene: SceneState,
    duration: EffectDuration | undefined,
  ): string => {
    // Effects are named after their move ("Trampa Rocas"); weathers arrive already translated.
    const name = names.effect(rawName);
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
