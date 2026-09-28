import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Stage } from '../components/Stage';
import { Logo } from '../components/ui/Logo';
import { PokeBall } from '../components/ui/PokeBall';
import { useRoomLocale } from '../lib/use-room-locale';
import { useAudioUnlock, useRoomAudio } from './audio/use-host-audio';
import { HostBattle } from './battle-scene/HostBattle';
import { useHostStore } from './host-store';
import { HostHeader } from './HostHeader';
import { HostLobby } from './HostLobby';
import { HostResults } from './HostResults';
import { HostTeamBuilding } from './HostTeamBuilding';

/** `/host` — the shared big screen. Owns the room; renders one view per room phase. */
export function HostScreen() {
  const { t } = useTranslation();
  const start = useHostStore((s) => s.start);
  const room = useHostStore((s) => s.room);
  const connection = useHostStore((s) => s.connection);
  const roomAt = useHostStore((s) => s.roomAt);

  useEffect(() => start(), [start]);
  useRoomLocale(room?.locale);
  useAudioUnlock();
  useRoomAudio(room, roomAt);

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

  const views = {
    LOBBY: HostLobby,
    TEAM_BUILDING: HostTeamBuilding,
    BATTLE: HostBattle,
    RESULTS: HostResults,
  } as const;
  const View = views[room.phase];
  return (
    <Stage>
      <div className="grid h-full grid-rows-[104px_minmax(0,1fr)]">
        <HostHeader room={room} showCode={room.phase !== 'LOBBY'} />
        <View room={room} />
      </div>
    </Stage>
  );
}
