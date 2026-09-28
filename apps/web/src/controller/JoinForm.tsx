import {
  PLAYER_NAME_MAX_LENGTH,
  TRAINER_AVATARS,
  playerNameSchema,
  randomTrainerAvatar,
} from '@poke-air/shared';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { TrainerSprite } from '../components/TrainerSprite';
import { useControllerStore } from './controller-store';

export function JoinForm({ code }: { code: string }) {
  const { t } = useTranslation();
  const { profile, setProfile, join, status, error } = useControllerStore();
  const nameValid = playerNameSchema.safeParse(profile.name).success;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (nameValid) void join();
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-6">
      <h1 className="text-center text-2xl font-black">{t('controller.joinTitle', { code })}</h1>

      <div className="flex flex-col items-center gap-2">
        <TrainerSprite avatar={profile.avatar} className="size-32" />
        <p className="font-semibold">{t(`trainers.${profile.avatar}`)}</p>
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-slate-300">{t('controller.name')}</span>
        <input
          value={profile.name}
          onChange={(e) => setProfile({ name: e.target.value })}
          maxLength={PLAYER_NAME_MAX_LENGTH}
          placeholder={t('controller.namePlaceholder')}
          autoComplete="nickname"
          className="rounded-xl bg-surface-raised px-4 py-3 text-lg outline-none focus:ring-2 focus:ring-accent"
        />
      </label>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-300">
            {t('controller.chooseTrainer')}
          </span>
          <button
            type="button"
            onClick={() => setProfile({ avatar: randomTrainerAvatar() })}
            className="rounded-lg bg-surface-raised px-3 py-1 text-sm"
          >
            🎲 {t('controller.randomTrainer')}
          </button>
        </div>
        <div className="grid max-h-64 grid-cols-5 gap-2 overflow-y-auto rounded-xl bg-black/20 p-2">
          {TRAINER_AVATARS.map((avatar) => (
            <button
              type="button"
              key={avatar}
              onClick={() => setProfile({ avatar })}
              className={`rounded-lg p-1 ${
                profile.avatar === avatar ? 'bg-accent/30 ring-2 ring-accent' : 'bg-surface-raised'
              }`}
            >
              <TrainerSprite avatar={avatar} className="size-12" />
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-center text-red-400">{t(`errors.${error}`)}</p>}

      <button
        type="submit"
        disabled={!nameValid || status === 'joining'}
        className="mt-auto rounded-xl bg-accent px-6 py-4 text-lg font-bold text-slate-900 disabled:opacity-40"
      >
        {status === 'joining' ? t('controller.joining') : t('controller.join')}
      </button>
    </form>
  );
}
