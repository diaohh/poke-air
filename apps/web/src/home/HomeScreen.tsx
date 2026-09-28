import { ROOM_CODE_LENGTH, type Locale } from '@poke-air/shared';
import { useState, type FormEvent } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { LanguageSelect } from '../components/LanguageSelect';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { Logo } from '../components/ui/Logo';
import { applyLocale } from '../i18n';
import { HeroScene } from './HeroScene';

/** `/` — landing page: host a room on this screen or join one with a code. */
export function HomeScreen() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [code, setCode] = useState('');

  const onJoin = (event: FormEvent) => {
    event.preventDefault();
    if (code.length === ROOM_CODE_LENGTH) void navigate(`/j/${code}`);
  };

  return (
    <div className="home flex min-h-full flex-col">
      <nav className="mx-auto flex w-full max-w-[1240px] items-center justify-between px-7 py-6">
        <Logo ballSize={36} className="gap-3 text-[28px]" />
        <LanguageSelect
          value={i18n.language as Locale}
          onChange={applyLocale}
          className="h-11 gap-2 rounded-full pr-3 pl-4 text-sm"
        />
      </nav>

      <main className="mx-auto grid w-full max-w-[1240px] flex-1 grid-cols-[minmax(0,1fr)] items-center gap-10 px-7 pt-2.5 pb-10 min-[900px]:grid-cols-[1.02fr_0.98fr]">
        <div>
          <h1 className="mb-5 font-display text-[clamp(54px,7vw,96px)] leading-[0.95]">
            <Trans
              i18nKey="home.heroTitle"
              components={{
                wine: <span className="text-wine" />,
                red: <span className="text-team-red" />,
                mark: <span className="home__mark" />,
              }}
            />
          </h1>
          <p className="mb-8 max-w-[520px] text-[19px] leading-relaxed text-ink-2">
            {t('home.lead')}
          </p>

          <div className="flex flex-wrap items-stretch gap-4">
            <Link to="/host" className="btn btn--primary min-h-16 px-8 text-xl max-[520px]:w-full">
              <Icon name="play" />
              {t('home.host')}
            </Link>
            <form
              onSubmit={onJoin}
              className="flex items-center gap-2 rounded-md bg-paper p-2 shadow-lift max-[520px]:w-full"
            >
              <label htmlFor="room-code" className="sr-only">
                {t('home.codeLabel')}
              </label>
              <input
                id="room-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                maxLength={ROOM_CODE_LENGTH}
                placeholder={t('home.codePlaceholder')}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                className="w-[150px] min-w-0 rounded-sm bg-paper-2 px-2.5 py-3 text-center font-display text-[26px] tracking-[0.3em] uppercase outline-none placeholder:text-muted focus:ring-3 focus:ring-wine max-[520px]:w-auto max-[520px]:flex-1"
              />
              <Button
                type="submit"
                variant="gold"
                disabled={code.length !== ROOM_CODE_LENGTH}
                className="min-h-12 px-5 text-base"
              >
                {t('home.joinButton')}
              </Button>
            </form>
          </div>
        </div>

        <HeroScene />
      </main>

      <p className="px-7 pb-8 text-center text-[13px] text-muted">{t('app.disclaimer')}</p>
    </div>
  );
}
