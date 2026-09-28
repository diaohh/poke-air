import { MAX_PLAYERS_PER_ROOM, type PublicRoomState } from '@poke-air/shared';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { PokeBall } from '../components/ui/PokeBall';
import { joinUrl, resolvePublicAppUrl } from '../lib/backend';

const STEPS = ['host.join.stepScan', 'host.join.stepProfile', 'host.join.stepTeam'] as const;

/** Wine lobby panel: room code tiles, join QR, URL, join steps and seat counter. */
export function JoinPanel({ room }: { room: PublicRoomState }) {
  const { t } = useTranslation();
  const [baseUrl, setBaseUrl] = useState<string>();

  useEffect(() => {
    void resolvePublicAppUrl().then(setBaseUrl);
  }, []);

  const url = baseUrl ? joinUrl(baseUrl, room.code) : undefined;
  const seated = room.players.length;

  return (
    <aside className="join-panel flex min-h-0 flex-col items-center gap-5 px-9 pt-9 pb-7.5">
      <p className="text-2xl font-black tracking-[0.18em] text-gold uppercase">
        {t('host.join.title')}
      </p>

      <div className="flex gap-3.5" aria-label={t('common.roomCode', { code: room.code })}>
        {room.code.split('').map((letter, i) => (
          <span key={i} aria-hidden="true" className="join-panel__tile h-30 w-[104px] text-[92px]">
            {letter}
          </span>
        ))}
      </div>

      <div className="grid size-[304px] place-items-center rounded-lg bg-qr p-5.5 shadow-[0_8px_0_var(--color-wine-deep)]">
        {url && (
          <QRCodeSVG
            value={url}
            size={260}
            bgColor="transparent"
            fgColor="currentColor"
            className="text-ink"
            title={url}
          />
        )}
      </div>

      <p className="join-panel__soft min-h-[34px] text-center text-2xl leading-snug break-all">
        {url && (
          <Trans
            i18nKey="host.join.orVisit"
            values={{ url: url.replace(/^https?:\/\//, '') }}
            components={{ b: <b className="font-extrabold text-paper" /> }}
          />
        )}
      </p>

      <ol className="mt-auto flex w-full flex-col gap-3">
        {STEPS.map((step, i) => (
          <li key={step} className="flex items-center gap-4 text-2xl font-semibold">
            <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-gold font-display text-2xl text-ink">
              {i + 1}
            </span>
            {t(step)}
          </li>
        ))}
      </ol>

      <div className="join-panel__divider join-panel__soft flex w-full items-center justify-between pt-5 text-[22px] font-bold">
        <span>{t('host.join.seats', { count: seated, max: MAX_PLAYERS_PER_ROOM })}</span>
        <span className="flex gap-2">
          {Array.from({ length: MAX_PLAYERS_PER_ROOM }, (_, i) => (
            <PokeBall
              key={i}
              size={28}
              tone={i < seated ? 'gold' : 'empty'}
              className="join-panel__seat"
            />
          ))}
        </span>
      </div>
    </aside>
  );
}
