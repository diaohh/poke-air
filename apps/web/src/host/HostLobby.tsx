import {
  GAME_TYPES,
  SUPPORTED_LOCALES,
  TEAM_IDS,
  TEAM_SIZE_LIMITS,
  type PublicRoomState,
} from '@poke-air/shared';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { joinUrl, resolvePublicAppUrl } from '../lib/backend';
import { useHostStore } from './host-store';
import { TeamColumn } from './TeamColumn';

export function HostLobby({ room }: { room: PublicRoomState }) {
  const { t } = useTranslation();
  const { setFormat, setLocale, kick, startTeamBuilding, error } = useHostStore();
  const [baseUrl, setBaseUrl] = useState<string>();

  useEffect(() => {
    void resolvePublicAppUrl().then(setBaseUrl);
  }, []);

  const url = baseUrl ? joinUrl(baseUrl, room.code) : undefined;
  const format = t(`formats.${room.gameType}`);
  const { max } = TEAM_SIZE_LIMITS[room.gameType];

  return (
    <div className="grid h-full grid-cols-[560px_1fr] gap-12 p-16">
      {/* Join panel */}
      <section className="flex flex-col items-center gap-8 rounded-3xl bg-surface-raised p-10">
        <h1 className="text-5xl font-black text-accent">{t('app.name')}</h1>
        <div className="text-center">
          <p className="text-2xl text-slate-400">{t('host.roomCode')}</p>
          <p className="font-mono text-9xl font-black tracking-widest">{room.code}</p>
        </div>
        {url && (
          <>
            <div className="rounded-2xl bg-white p-5">
              <QRCodeSVG value={url} size={300} />
            </div>
            <p className="text-center text-2xl text-slate-300">
              {t('host.scanToJoin')}
              <br />
              <span className="text-xl text-slate-500">{t('host.orVisit', { url })}</span>
            </p>
          </>
        )}
      </section>

      {/* Teams and settings */}
      <section className="flex flex-col gap-10">
        <div className="flex items-center gap-10 text-3xl">
          <span className="text-slate-400">{t('host.format')}</span>
          <div className="flex gap-3">
            {GAME_TYPES.map((gameType) => (
              <button
                key={gameType}
                onClick={() => void setFormat(gameType)}
                className={`rounded-xl px-8 py-3 font-bold ${
                  room.gameType === gameType ? 'bg-accent text-slate-900' : 'bg-surface-raised'
                }`}
              >
                {t(`formats.${gameType}`)}
              </button>
            ))}
          </div>
          <span className="ml-auto text-slate-400">{t('host.language')}</span>
          <select
            value={room.locale}
            onChange={(e) => void setLocale(e.target.value as (typeof SUPPORTED_LOCALES)[number])}
            className="rounded-xl bg-surface-raised px-4 py-3"
          >
            {SUPPORTED_LOCALES.map((locale) => (
              <option key={locale} value={locale}>
                {t(`locales.${locale}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-10">
          {TEAM_IDS.map((team) => (
            <TeamColumn
              key={team}
              team={team}
              players={room.players.filter((p) => p.team === team)}
              onKick={(id) => void kick(id)}
            />
          ))}
        </div>

        <footer className="flex items-center gap-8">
          <p
            className={`flex-1 text-3xl ${room.composition.valid ? 'text-emerald-400' : 'text-slate-400'}`}
          >
            {room.players.length === 0
              ? t('host.waitingForPlayers')
              : room.composition.valid
                ? t('host.composition.valid', { label: room.composition.label, format })
                : room.composition.issues
                    .map(({ team, issue }) =>
                      t(`host.composition.${issue}`, { team: t(`teams.${team}`), format, max }),
                    )
                    .join(' · ')}
          </p>
          {error && <p className="text-2xl text-red-400">{t(`errors.${error}`)}</p>}
          <button
            onClick={() => void startTeamBuilding()}
            disabled={!room.composition.valid}
            className="rounded-2xl bg-accent px-16 py-6 text-4xl font-black text-slate-900 disabled:opacity-30"
          >
            {t('host.startGame')}
          </button>
        </footer>
      </section>
    </div>
  );
}
