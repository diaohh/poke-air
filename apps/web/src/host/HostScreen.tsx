import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Stage } from '../components/Stage';
import { useRoomLocale } from '../lib/use-room-locale';
import { useHostStore } from './host-store';
import { HostLobby } from './HostLobby';

/** `/host` — the shared big screen. Owns the room; renders one view per room phase. */
export function HostScreen() {
  const { t } = useTranslation();
  const start = useHostStore((s) => s.start);
  const room = useHostStore((s) => s.room);
  const connection = useHostStore((s) => s.connection);
  const backToLobby = useHostStore((s) => s.backToLobby);

  useEffect(() => start(), [start]);
  useRoomLocale(room?.locale);

  return (
    <Stage>
      {!room ? (
        <div className="flex h-full flex-col items-center justify-center gap-6 text-4xl text-slate-300">
          <p>{t('common.connecting')}</p>
          {connection === 'offline' && (
            <p className="text-2xl text-slate-500">{t('common.wakingUp')}</p>
          )}
        </div>
      ) : room.phase === 'LOBBY' ? (
        <HostLobby room={room} />
      ) : (
        // Phase 1 replaces this placeholder with team-building progress and, later, the battle scene.
        <div className="flex h-full flex-col items-center justify-center gap-8">
          <h1 className="text-7xl font-black text-accent">{t('host.teamBuilding.title')}</h1>
          <p className="text-3xl text-slate-300">{t('host.teamBuilding.comingSoon')}</p>
          <button
            onClick={() => void backToLobby()}
            className="rounded-2xl bg-surface-raised px-10 py-5 text-3xl font-bold hover:brightness-125"
          >
            {t('host.teamBuilding.backToLobby')}
          </button>
        </div>
      )}
    </Stage>
  );
}
