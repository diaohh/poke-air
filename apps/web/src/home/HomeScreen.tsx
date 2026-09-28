import { ROOM_CODE_LENGTH } from '@poke-air/shared';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';

export function HomeScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [code, setCode] = useState('');

  const onJoin = (event: FormEvent) => {
    event.preventDefault();
    if (code.length === ROOM_CODE_LENGTH) void navigate(`/j/${code}`);
  };

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-10 p-6 text-center">
      <header>
        <h1 className="text-5xl font-black tracking-tight text-accent">{t('app.name')}</h1>
        <p className="mt-3 text-slate-300">{t('app.tagline')}</p>
      </header>

      <Link
        to="/host"
        className="w-full rounded-xl bg-accent px-6 py-4 text-lg font-bold text-slate-900 hover:brightness-110"
      >
        {t('home.host')}
      </Link>

      <form onSubmit={onJoin} className="flex w-full flex-col gap-3">
        <label htmlFor="room-code" className="text-sm font-semibold text-slate-300">
          {t('home.join')}
        </label>
        <div className="flex gap-2">
          <input
            id="room-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
            maxLength={ROOM_CODE_LENGTH}
            placeholder={t('home.codePlaceholder')}
            autoCapitalize="characters"
            autoComplete="off"
            className="min-w-0 flex-1 rounded-xl bg-surface-raised px-4 py-3 text-center text-2xl font-bold tracking-[0.4em] uppercase outline-none focus:ring-2 focus:ring-accent"
          />
          <button
            type="submit"
            disabled={code.length !== ROOM_CODE_LENGTH}
            className="rounded-xl bg-team-blue px-5 font-bold disabled:opacity-40"
          >
            {t('home.joinButton')}
          </button>
        </div>
      </form>

      <p className="text-xs text-slate-500">{t('app.disclaimer')}</p>
    </main>
  );
}
