import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { Button } from '../components/ui/Button';
import { CodeChip } from '../components/ui/CodeChip';
import { Logo } from '../components/ui/Logo';
import { PokeBall } from '../components/ui/PokeBall';
import { TeamChip } from '../components/ui/TeamChip';
import { cn } from '../lib/cn';
import { TEAM_SCOPE } from '../lib/team';
import { useRoomLocale } from '../lib/use-room-locale';
import { useWakeLock } from '../lib/use-wake-lock';
import { useControllerStore } from './controller-store';
import { ControllerLobby } from './ControllerLobby';
import { JoinForm } from './JoinForm';

/**
 * `/j/:code` — the phone controller (portrait). Themed with the player's team colors once joined;
 * neutral wine/blush before. The primary action of every view is pinned to the bottom.
 */
export function ControllerScreen() {
  const { t } = useTranslation();
  const { code = '' } = useParams();
  const { open, status, room, online, removedReason, join, playerId } = useControllerStore();
  const roomCode = code.toUpperCase();
  const me = room?.players.find((p) => p.id === playerId);
  const joined = status === 'joined' && room && me;

  useEffect(() => open(code), [open, code]);
  useRoomLocale(room?.locale);
  useWakeLock(status === 'joined');

  return (
    <div
      className={cn(
        'phone-shell mx-auto flex h-dvh max-w-md flex-col gap-3.5 px-4.5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]',
        TEAM_SCOPE[joined ? me.team : 'neutral'],
      )}
    >
      <header className="flex min-h-10 items-center justify-between gap-2">
        {joined ? (
          <TeamChip team={me.team} className="text-sm" />
        ) : (
          <Logo ballSize={26} className="gap-2 text-xl" />
        )}
        <CodeChip code={roomCode} />
      </header>

      {!online && status !== 'removed' && status !== 'connecting' && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-md bg-warn-soft px-3.5 py-2.5 text-sm font-semibold text-warn-deep"
        >
          <span className="size-2.5 shrink-0 animate-pulse rounded-full bg-warn" />
          {t('common.reconnecting')}
        </p>
      )}

      {status === 'connecting' && (
        <CenteredMessage>
          <PokeBall size={72} tone="brand" animation="spin" />
          <p className="text-base font-semibold text-ink-2">{t('common.connecting')}</p>
          {!online && <p className="text-sm text-ink-2">{t('common.wakingUp')}</p>}
        </CenteredMessage>
      )}

      {(status === 'form' || status === 'joining') && <JoinForm />}

      {joined && room.phase === 'LOBBY' && <ControllerLobby room={room} me={me} />}

      {joined && room.phase !== 'LOBBY' && (
        // Phase 1 replaces this with the team builder and, later, the battle controls.
        <CenteredMessage>
          <PokeBall size={72} tone="team" animation="bounce" />
          <p className="text-base font-semibold text-ink-2">{t('controller.teamBuildingSoon')}</p>
        </CenteredMessage>
      )}

      {status === 'removed' && (
        <>
          <CenteredMessage>
            <PokeBall size={72} tone="empty" />
            <p className="text-lg font-bold">
              {t(`controller.removed.${removedReason ?? 'kicked'}`)}
            </p>
          </CenteredMessage>
          <Button variant="primary" onClick={() => void join()} className="min-h-15 text-[19px]">
            {t('controller.joinAgain')}
          </Button>
        </>
      )}
    </div>
  );
}

function CenteredMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-4 text-center">
      {children}
    </div>
  );
}
