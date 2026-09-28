import type { TrainerAvatar } from '@poke-air/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';

interface Props {
  avatar: TrainerAvatar;
  className?: string;
  /** Decorative: the name is shown next to it, so screen readers skip the image. */
  decorative?: boolean;
}

/**
 * Trainer sprite served from our own `/sprites/trainers/` (downloaded by `pnpm fetch:sprites`,
 * never hotlinked). Falls back to the trainer's initial if the file is missing.
 */
export function TrainerSprite({ avatar, className = 'size-16', decorative }: Props) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const name = t(`trainers.${avatar}`);

  if (failed) {
    return (
      <div
        className={cn(
          '@container flex items-center justify-center rounded-full bg-canvas-deep font-display text-wine',
          className,
        )}
        role={decorative ? undefined : 'img'}
        aria-label={decorative ? undefined : name}
        aria-hidden={decorative}
      >
        <span className="text-[length:45cqw] leading-none">{name.charAt(0)}</span>
      </div>
    );
  }
  return (
    <img
      src={`/sprites/trainers/${avatar}.png`}
      alt={decorative ? '' : name}
      className={cn('pixelated object-contain', className)}
      onError={() => setFailed(true)}
      draggable={false}
    />
  );
}
