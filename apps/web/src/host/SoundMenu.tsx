import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconButton } from '../components/ui/IconButton';
import { cn } from '../lib/cn';
import { useAudioStore } from './audio/audio-store';
import { playSfx } from './audio/engine';

/** Header sound button + popover: mute, music / effects volume, Pokémon cries. */
export function SoundMenu() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const { muted, music, effects, cries, criesAvailable, musicMissing, set } = useAudioStore();

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (
        event instanceof KeyboardEvent
          ? event.key === 'Escape'
          : !root.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <IconButton
        icon={muted ? 'soundOff' : 'sound'}
        label={t('host.sound.menu')}
        raised
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="size-15 rounded-md text-[28px]"
      />
      {open && (
        <div
          role="dialog"
          aria-label={t('host.sound.menu')}
          className="absolute top-[76px] right-0 z-50 flex w-[420px] flex-col gap-5 rounded-lg bg-paper p-6 text-[22px] font-bold shadow-float"
        >
          <Toggle
            label={muted ? t('host.sound.off') : t('host.sound.on')}
            on={!muted}
            onChange={(on) => set({ muted: !on })}
          />
          <Slider
            label={t('host.sound.music')}
            value={music}
            disabled={muted}
            onChange={(value) => set({ music: value })}
            {...(musicMissing ? { hint: t('host.sound.musicMissing') } : {})}
          />
          <Slider
            label={t('host.sound.effects')}
            value={effects}
            disabled={muted}
            onChange={(value) => set({ effects: value })}
            onCommit={() => playSfx('ready')}
          />
          <Toggle
            label={t('host.sound.cries')}
            on={cries && criesAvailable !== false}
            disabled={muted || criesAvailable === false}
            onChange={(on) => set({ cries: on })}
            {...(criesAvailable === false ? { hint: t('host.sound.criesMissing') } : {})}
          />
        </div>
      )}
    </div>
  );
}

interface ToggleProps {
  label: string;
  on: boolean;
  disabled?: boolean;
  hint?: string;
  onChange: (on: boolean) => void;
}

function Toggle({ label, on, disabled, hint, onChange }: ToggleProps) {
  return (
    <div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={disabled}
        onClick={() => onChange(!on)}
        className={cn(
          'toggle flex w-full items-center justify-between gap-4 disabled:opacity-50',
          on && 'toggle--on',
        )}
      >
        {label}
        <span className="toggle__track" />
      </button>
      {hint && <p className="mt-1.5 text-base font-semibold text-muted">{hint}</p>}
    </div>
  );
}

interface SliderProps {
  label: string;
  value: number;
  disabled?: boolean;
  hint?: string;
  onChange: (value: number) => void;
  onCommit?: () => void;
}

function Slider({ label, value, disabled, hint, onChange, onCommit }: SliderProps) {
  return (
    <label className={cn('flex flex-col gap-2', disabled && 'opacity-50')}>
      <span className="flex justify-between">
        {label}
        <span className="text-muted tabular-nums">{Math.round(value * 100)}%</span>
      </span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        onPointerUp={onCommit}
        className="h-3 w-full cursor-pointer accent-wine"
      />
      {hint && <span className="text-base font-semibold text-muted">{hint}</span>}
    </label>
  );
}
