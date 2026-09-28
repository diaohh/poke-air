import type { PublicRoomState } from '@poke-air/shared';
import { useTranslation } from 'react-i18next';
import { LanguageSelect } from '../components/LanguageSelect';
import { IconButton } from '../components/ui/IconButton';
import { Logo } from '../components/ui/Logo';
import { toggleFullscreen } from '../lib/fullscreen';
import { useHostStore } from './host-store';

interface Props {
  room: PublicRoomState;
  /** Small room-code pill (phases without the join panel). */
  showCode?: boolean;
}

/** Host header: logo · (room code) · language · fullscreen. No phase stepper. */
export function HostHeader({ room, showCode }: Props) {
  const { t } = useTranslation();
  const setLocale = useHostStore((s) => s.setLocale);

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
      <IconButton
        icon="fullscreen"
        label={t('host.fullscreen')}
        raised
        onClick={toggleFullscreen}
        className="size-15 rounded-md text-[28px]"
      />
    </header>
  );
}
