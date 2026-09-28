import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { useRoomLocale } from '../lib/use-room-locale';
import { useWakeLock } from '../lib/use-wake-lock';
import { useControllerStore } from './controller-store';
import { ControllerLobby } from './ControllerLobby';
import { JoinForm } from './JoinForm';

/** `/j/:code` — the phone controller. */
export function ControllerScreen() {
  const { t } = useTranslation();
  const { code = '' } = useParams();
  const { open, status, room, online, removedReason, join } = useControllerStore();

  useEffect(() => open(code), [open, code]);
  useRoomLocale(room?.locale);
  useWakeLock(status === 'joined');

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      {!online && status !== 'removed' && (
        <p className="mb-3 rounded-lg bg-amber-500/20 p-3 text-center text-sm text-amber-200">
          {status === 'connecting' ? t('common.wakingUp') : t('common.connecting')}
        </p>
      )}

      {status === 'connecting' && <p className="m-auto text-slate-400">{t('common.connecting')}</p>}

      {(status === 'form' || status === 'joining') && <JoinForm code={code.toUpperCase()} />}

      {status === 'joined' && room?.phase === 'LOBBY' && <ControllerLobby room={room} />}

      {status === 'joined' && room && room.phase !== 'LOBBY' && (
        // Phase 1 replaces this with the team builder and, later, the battle controls.
        <p className="m-auto text-center text-lg text-slate-300">
          {t('controller.teamBuildingSoon')}
        </p>
      )}

      {status === 'removed' && (
        <div className="m-auto flex flex-col items-center gap-6 text-center">
          <p className="text-lg">{t(`controller.removed.${removedReason ?? 'kicked'}`)}</p>
          <button
            onClick={() => void join()}
            className="rounded-xl bg-accent px-6 py-3 font-bold text-slate-900"
          >
            {t('controller.joinAgain')}
          </button>
        </div>
      )}
    </main>
  );
}
