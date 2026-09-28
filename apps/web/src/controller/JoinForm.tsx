import {
  PLAYER_NAME_MAX_LENGTH,
  TRAINER_AVATARS,
  playerNameSchema,
  randomTrainerAvatar,
} from '@poke-air/shared';
import { useRef, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { TrainerSprite } from '../components/TrainerSprite';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { cn } from '../lib/cn';
import { enterFullscreen, isTouchDevice } from '../lib/fullscreen';
import { useControllerStore } from './controller-store';

/** Join view: name · scrollable 4-column trainer grid · dice for a random trainer · Join room. */
export function JoinForm() {
  const { t } = useTranslation();
  const { profile, setProfile, join, status, error } = useControllerStore();
  const gridRef = useRef<HTMLDivElement>(null);
  const nameValid = playerNameSchema.safeParse(profile.name).success;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!nameValid) return;
    // Hide the browser bars on phones; the submit is the required user gesture.
    if (isTouchDevice()) void enterFullscreen();
    void join();
  };

  const pickRandom = () => {
    const avatar = randomTrainerAvatar();
    setProfile({ avatar });
    gridRef.current
      ?.querySelector(`[data-avatar="${avatar}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  return (
    <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col gap-3.5">
      <h1 className="font-display text-[30px] leading-tight">{t('controller.joinTitle')}</h1>

      <label className="block">
        <span className="field-label text-[13px]">{t('controller.name')}</span>
        <input
          value={profile.name}
          onChange={(e) => setProfile({ name: e.target.value })}
          maxLength={PLAYER_NAME_MAX_LENGTH}
          placeholder={t('controller.namePlaceholder')}
          autoComplete="nickname"
          enterKeyHint="go"
          className="field mt-2 h-14 px-4 text-xl"
        />
      </label>

      <div className="flex items-center justify-between gap-2.5">
        <div>
          <p className="field-label text-[13px]">{t('controller.trainer')}</p>
          <p className="font-display text-[22px] text-wine">{t(`trainers.${profile.avatar}`)}</p>
        </div>
        <Button
          variant="gold"
          aria-label={t('controller.randomTrainer')}
          title={t('controller.randomTrainer')}
          onClick={pickRandom}
          className="size-12 rounded-[14px] text-2xl"
        >
          <Icon name="dice" />
        </Button>
      </div>

      <div
        ref={gridRef}
        role="radiogroup"
        aria-label={t('controller.trainer')}
        className="-mx-1.5 min-h-0 flex-1 overflow-y-auto px-1.5 pt-1 pb-2.5"
      >
        <div className="grid grid-cols-4 gap-2">
          {TRAINER_AVATARS.map((avatar) => {
            const selected = profile.avatar === avatar;
            return (
              <button
                type="button"
                key={avatar}
                data-avatar={avatar}
                role="radio"
                aria-checked={selected}
                aria-label={t(`trainers.${avatar}`)}
                onClick={() => setProfile({ avatar })}
                className={cn(
                  'trainer-tile grid aspect-square place-items-center overflow-hidden rounded-2xl',
                  selected && 'trainer-tile--selected',
                )}
              >
                <TrainerSprite avatar={avatar} decorative className="size-full" />
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <p role="alert" className="text-center text-sm font-semibold text-warn-deep">
          {t(`errors.${error}`)}
        </p>
      )}

      <Button
        type="submit"
        variant="primary"
        disabled={!nameValid || status === 'joining'}
        className="min-h-15 w-full text-[19px]"
      >
        {status === 'joining' ? t('controller.joining') : t('controller.join')}
      </Button>
    </form>
  );
}
