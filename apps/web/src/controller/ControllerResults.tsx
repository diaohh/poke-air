import type { PublicPlayer, PublicRoomState } from '@poke-air/shared';
import { useTranslation } from 'react-i18next';
import { PokeBall } from '../components/ui/PokeBall';

/** Phone RESULTS: Victory / Defeat / Draw + own team summary; the Host picks what's next. */
export function ControllerResults({ room, me }: { room: PublicRoomState; me: PublicPlayer }) {
  const { t } = useTranslation();
  const result = room.result;
  if (!result) return null;
  const summary = result.teams[me.team];
  const title =
    result.winner === null
      ? t('results.draw')
      : result.winner === me.team
        ? t('results.victory')
        : t('results.defeat');

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
      <PokeBall
        size={104}
        tone={result.winner === me.team ? 'gold' : 'team'}
        animation={result.winner === me.team ? 'wobble' : undefined}
      />
      <h1 className="font-display text-[46px] leading-none">{title}</h1>
      <div className="phone-card flex w-full items-center justify-around rounded-[22px] p-4">
        <div>
          <b className="font-display text-4xl text-(color:--deep)">{summary.kos}</b>
          <p className="field-label text-xs">{t('results.kos')}</p>
        </div>
        <div>
          <b className="font-display text-4xl text-(color:--deep)">
            {summary.remaining}/{summary.total}
          </b>
          <p className="field-label text-xs">{t('results.remaining')}</p>
        </div>
      </div>
      <p
        role="status"
        className="flex max-w-[300px] items-center gap-3 text-left text-[15px] font-bold text-ink-2"
      >
        <PokeBall size={26} tone="team" animation="bounce" />
        {t('results.waitingHost')}
      </p>
    </div>
  );
}
