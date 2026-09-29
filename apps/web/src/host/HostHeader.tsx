import type { PublicRoomState } from '@poke-air/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { LanguageSelect } from '../components/LanguageSelect';
import { Button } from '../components/ui/Button';
import { IconButton } from '../components/ui/IconButton';
import { Logo } from '../components/ui/Logo';
import { toggleFullscreen } from '../lib/fullscreen';
import { useHostStore } from './host-store';
import { SoundMenu } from './SoundMenu';

interface Props {
  room: PublicRoomState;
  /** Small room-code pill (phases without the join panel). */
  showCode?: boolean;
}

/** Host header: logo · (room code) · language · sound · fullscreen · close room. No phase stepper. */
export function HostHeader({ room, showCode }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setLocale = useHostStore((s) => s.setLocale);
  const closeRoom = useHostStore((s) => s.closeRoom);
  const [confirming, setConfirming] = useState(false);

  const close = async () => {
    await closeRoom();
    void navigate('/');
  };

  return (
    <header className="flex h-[104px] items-center gap-5 px-11">
      <Logo ballSize={50} className="mr-auto gap-4 text-[40px]" />
      {showCode && (
        <div className="flex h-15 items-center gap-3 rounded-md bg-paper px-5.5 text-[22px] font-bold shadow-lift">
          {t('host.room')}
          <span className="font-display text-[30px] tracking-[0.14em] text-wine">{room.code}</span>
        </div>
      )}
      <LanguageSelect
        value={room.locale}
        onChange={(locale) => void setLocale(locale)}
        className="h-15 gap-3 rounded-md pr-5.5 pl-5.5 text-[22px]"
      />
      <SoundMenu />
      <IconButton
        icon="fullscreen"
        label={t('host.fullscreen')}
        raised
        onClick={toggleFullscreen}
        className="size-15 rounded-md text-[28px]"
      />
      <IconButton
        icon="exit"
        label={t('host.close.button')}
        raised
        onClick={() => setConfirming(true)}
        className="size-15 rounded-md text-[28px]"
      />

      {confirming && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="close-room-title"
          className="fixed inset-0 z-50 grid place-items-center bg-ink/45"
        >
          <div className="flex w-[720px] flex-col gap-6 rounded-lg bg-paper p-11 shadow-float">
            <h2 id="close-room-title" className="font-display text-[48px] leading-tight">
              {t('host.close.title')}
            </h2>
            <p className="text-[26px] leading-snug text-ink-2">{t('host.close.body')}</p>
            <div className="grid grid-cols-2 gap-5">
              <Button
                variant="ghost"
                onClick={() => setConfirming(false)}
                className="min-h-18 text-[26px]"
              >
                {t('host.close.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={() => void close()}
                className="min-h-18 text-[26px]"
              >
                {t('host.close.confirm')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
