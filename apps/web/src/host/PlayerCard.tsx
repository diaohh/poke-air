import type { PublicPlayer } from '@poke-air/shared';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { TrainerSprite } from '../components/TrainerSprite';
import { IconButton } from '../components/ui/IconButton';
import { cn } from '../lib/cn';

interface Props {
  player: PublicPlayer;
  /** Replaces the trainer-name line (e.g. a status pill during team building). */
  status?: ReactNode;
  /** Shows a kick button on hover (lobby only). */
  onKick?: () => void;
}

/**
 * Host player card: trainer sprite on a team-tinted battle platform + name. Disconnected players
 * get a grey card, a grayscale sprite and the word "Disconnected". Needs a team scope ancestor.
 */
export function PlayerCard({ player, status, onKick }: Props) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        'player-card group relative grid h-[196px] grid-cols-[168px_minmax(0,1fr)] items-center gap-5.5 rounded-lg pr-7 pl-4',
        !player.connected && 'player-card--offline',
      )}
    >
      <div className="platform size-[168px]">
        <TrainerSprite avatar={player.avatar} decorative className="size-40" />
      </div>
      <div className="min-w-0">
        <p
          className={cn(
            'truncate text-[44px] leading-tight font-extrabold',
            !player.connected && 'text-muted',
          )}
        >
          {player.name}
        </p>
        <div className="mt-2.5 flex items-center gap-2.5 text-2xl font-semibold text-ink-2">
          {player.connected ? (
            (status ?? (
              <>
                <span className="size-3.5 shrink-0 rounded-full bg-ok ring-5 ring-ok-soft" />
                {t(`trainers.${player.avatar}`)}
              </>
            ))
          ) : (
            <>
              <span className="size-3.5 shrink-0 rounded-full bg-muted ring-5 ring-muted/20" />
              {t('common.disconnected')}
            </>
          )}
        </div>
      </div>
      {onKick && (
        <IconButton
          icon="x"
          danger
          label={t('host.kick', { name: player.name })}
          onClick={onKick}
          className="absolute top-3.5 right-3.5 size-12 text-[26px] opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        />
      )}
    </div>
  );
}
