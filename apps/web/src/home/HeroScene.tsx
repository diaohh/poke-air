import { useTranslation } from 'react-i18next';
import { TrainerSprite } from '../components/TrainerSprite';
import { HpBar } from '../components/ui/HpBar';
import { PokeBall } from '../components/ui/PokeBall';
import { TeamChip } from '../components/ui/TeamChip';
import { TEAM_SCOPE } from '../lib/team';

/** Decorative hero illustration: the TV is the stadium, the phones are the controllers. */
export function HeroScene() {
  const { t } = useTranslation();

  return (
    <div
      aria-hidden="true"
      className="scene h-[520px] max-[900px]:h-[380px] max-[900px]:max-w-[520px] max-[520px]:hidden"
    >
      <div className="scene__tv">
        <div className="scene__screen">
          <span className="scene__platform top-[44%] right-[8%] h-[12%] w-[30%]" />
          <span className="scene__platform bottom-[10%] left-[6%] h-[16%] w-[38%]" />
          <TrainerSprite
            avatar="lance"
            decorative
            className="absolute top-[16%] right-[12%] w-[21%]"
          />
          <TrainerSprite
            avatar="cynthia"
            decorative
            className="absolute bottom-[14%] left-[12%] w-[26%]"
          />
          <div className="scene__hp top-[8%] left-[5%]">
            <HpBar percent={46} className="h-2" />
          </div>
          <div className="scene__hp right-[5%] bottom-[8%]">
            <HpBar percent={82} className="h-2" />
          </div>
        </div>
      </div>

      <div className={`scene__phone ${TEAM_SCOPE.red} -bottom-1.5 -left-[2%] -rotate-9`}>
        <div className="scene__phone-screen justify-end">
          <span className="text-[10px] font-extrabold tracking-widest text-ink-2 uppercase">
            {t('home.sceneTurn')}
          </span>
          <span className="grid flex-3 place-items-center rounded-2xl bg-wine font-display text-[26px] text-paper shadow-[0_4px_0_var(--color-wine-deep)]">
            {t('battle.fight')}
          </span>
          <span className="grid flex-2 place-items-center rounded-sm bg-gold font-display text-[15px] shadow-[0_3px_0_var(--color-gold-deep)]">
            {t('battle.pokemon')}
          </span>
        </div>
      </div>

      <div className={`scene__phone ${TEAM_SCOPE.blue} -right-[1%] bottom-1.5 rotate-8`}>
        <div className="scene__phone-screen items-center justify-center gap-4">
          <PokeBall size={40} tone="team" animation="bounce" />
          <TeamChip team="blue" ballSize={16} className="text-[11px]" />
        </div>
      </div>
    </div>
  );
}
