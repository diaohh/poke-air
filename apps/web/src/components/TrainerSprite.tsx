import type { TrainerAvatar } from '@poke-air/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  avatar: TrainerAvatar;
  className?: string;
}

/**
 * Trainer sprite served from our own `/sprites/trainers/` (downloaded by `pnpm fetch:sprites`,
 * never hotlinked). Falls back to the trainer's initial if the file is missing.
 */
export function TrainerSprite({ avatar, className = 'size-16' }: Props) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const name = t(`trainers.${avatar}`);

  if (failed) {
    return (
      <div
        className={`${className} flex items-center justify-center rounded-full bg-slate-700 font-bold text-slate-200`}
        aria-label={name}
      >
        {name.charAt(0)}
      </div>
    );
  }
  return (
    <img
      src={`/sprites/trainers/${avatar}.png`}
      alt={name}
      className={`${className} pixelated object-contain`}
      onError={() => setFailed(true)}
      draggable={false}
    />
  );
}
