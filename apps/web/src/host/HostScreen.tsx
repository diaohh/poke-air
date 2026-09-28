import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Stage } from '../components/Stage';
import { Logo } from '../components/ui/Logo';
import { PokeBall } from '../components/ui/PokeBall';
import { useRoomLocale } from '../lib/use-room-locale';
import { useHostStore } from './host-store';
import { HostHeader } from './HostHeader';
import { HostLobby } from './HostLobby';
import { HostTeamBuilding } from './HostTeamBuilding';

/** `/host` — the shared big screen. Owns the room; renders one view per room phase. */
export function HostScreen() {
  const { t } = useTranslation();
  const start = useHostStore((s) => s.start);
  const room = useHostStore((s) => s.room);
  const connection = useHostStore((s) => s.connection);

  useEffect(() => start(), [start]);
  useRoomLocale(room?.locale);

  if (!room) {
    return (
      <Stage>
        <div className="flex h-full flex-col items-center justify-center gap-10">
          <Logo ballSize={64} className="gap-5 text-[56px]" />
          <PokeBall size={120} tone="brand" animation="spin" />
          <p className="text-4xl font-semibold text-ink-2" role="status">
            {t('common.connecting')}
          </p>
          {connection === 'offline' && (
            <p className="text-2xl text-muted">{t('common.wakingUp')}</p>
          )}
        </div>
      </Stage>
    );
  }

  const lobby = room.phase === 'LOBBY';
  return (
    <Stage>
      <div className="grid h-full grid-rows-[104px_minmax(0,1fr)]">
        <HostHeader room={room} showCode={!lobby} />
        {/* Phase 1 adds the battle scene and results; until then later phases reuse team building. */}
        {lobby ? <HostLobby room={room} /> : <HostTeamBuilding room={room} />}
      </div>
    </Stage>
  );
}
