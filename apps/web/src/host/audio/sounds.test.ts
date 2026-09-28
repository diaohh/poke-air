import { describe, expect, it } from 'vitest';
import type { SceneEvent } from '../battle-scene/model';
import { sfxForEvent } from './sounds';

const message = (key: string) => ({ kind: 'message', narration: { key } }) as SceneEvent;
const damage: SceneEvent = { kind: 'damage', side: 'p2' };

describe('sfxForEvent', () => {
  it('picks the attack sound from the move category', () => {
    const move: SceneEvent = { kind: 'move', side: 'p1', move: 'Earthquake' };
    expect(sfxForEvent(move, 'Physical', null)).toBe('swing');
    expect(sfxForEvent(move, 'Special', null)).toBe('beam');
    expect(sfxForEvent(move, 'Status', null)).toBe('cast');
    expect(sfxForEvent(move, undefined, null)).toBe('cast');
  });

  it('lets effectiveness and crits carry the hit, so the damage after them is silent', () => {
    expect(sfxForEvent(message('superEffective'), undefined, null)).toBe('hitStrong');
    expect(sfxForEvent(damage, undefined, message('superEffective'))).toBeNull();
    expect(sfxForEvent(message('crit'), undefined, null)).toBe('crit');
    expect(sfxForEvent(damage, undefined, message('used'))).toBe('hit');
    expect(sfxForEvent(damage, undefined, null)).toBe('hit');
  });

  it('uses a soft hit for residual damage and maps the rest', () => {
    const residual = { ...damage, narration: { key: 'hurtByStatus.brn' } } as SceneEvent;
    expect(sfxForEvent(residual, undefined, null)).toBe('hitWeak');
    expect(sfxForEvent({ kind: 'faint' }, undefined, null)).toBe('faint');
    expect(sfxForEvent({ kind: 'mega' }, undefined, null)).toBe('mega');
    expect(sfxForEvent({ kind: 'end' }, undefined, null)).toBe('fanfare');
    expect(sfxForEvent({ kind: 'turn' }, undefined, null)).toBeNull();
    expect(sfxForEvent(message('weatherStart'), undefined, null)).toBeNull();
  });
});
