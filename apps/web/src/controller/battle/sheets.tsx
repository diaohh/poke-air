import type { BattleMoveOption, BattlePokemon } from '@poke-air/shared';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/Button';
import { HpBar } from '../../components/ui/HpBar';
import { Sheet } from '../../components/ui/Sheet';
import { cn } from '../../lib/cn';
import { isLightType, typeStyle } from '../../lib/pokemon-types';

export function TypeChip({ type, className }: { type: string; className?: string }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn('type-chip', isLightType(type) && 'type-chip--light', className)}
      style={typeStyle(type)}
    >
      {t(`types.${type as 'Normal'}`, { defaultValue: type })}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat-box rounded-[14px] p-2.5 text-center">
      <small className="block text-[11px] font-extrabold tracking-widest text-muted uppercase">
        {label}
      </small>
      <b className="text-xl font-extrabold">{value}</b>
    </div>
  );
}

interface MoveSheetProps {
  move: BattleMoveOption;
  onClose: () => void;
  onUse: () => void;
}

/** Type, category, power, accuracy, PP, description + "Use move". */
export function MoveSheet({ move, onClose, onUse }: MoveSheetProps) {
  const { t } = useTranslation();
  return (
    <Sheet title={move.name} onClose={onClose}>
      <div className="flex flex-wrap gap-1.5">
        <TypeChip type={move.type} className="px-3 py-1.5 text-xs" />
        <span className="rounded-full bg-paper-2 px-3 py-1.5 text-xs font-extrabold text-ink-2">
          {t(`battle.categories.${move.category}`)}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label={t('battle.power')} value={move.basePower || '—'} />
        <Stat
          label={t('battle.accuracy')}
          value={move.accuracy === true ? '—' : `${move.accuracy}%`}
        />
        <Stat label={t('battle.pp')} value={move.maxpp ? `${move.pp}/${move.maxpp}` : '—'} />
      </div>
      {move.description && (
        <p className="text-[15px] leading-normal text-ink-2">{move.description}</p>
      )}
      <div className="sheet__actions">
        <Button variant="ghost" onClick={onClose} className="min-h-13.5 text-[17px]">
          {t('common.close')}
        </Button>
        <Button
          variant="primary"
          disabled={move.disabled}
          onClick={onUse}
          className="min-h-13.5 text-[17px]"
        >
          {t('battle.useMove')}
        </Button>
      </div>
    </Sheet>
  );
}

interface PokemonSheetProps {
  pokemon: BattlePokemon;
  canSwitch: boolean;
  onClose: () => void;
  onSwitch: () => void;
}

/** Item, ability, HP, moves + "Switch in". */
export function PokemonSheet({ pokemon, canSwitch, onClose, onSwitch }: PokemonSheetProps) {
  const { t } = useTranslation();
  const percent = pokemon.maxhp ? (pokemon.hp / pokemon.maxhp) * 100 : 0;
  const label = pokemon.active
    ? t('battle.inBattle')
    : pokemon.fainted
      ? t('battle.fainted')
      : t('battle.switchIn');

  return (
    <Sheet title={pokemon.name} onClose={onClose}>
      <HpBar percent={percent} />
      <dl className="grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 text-[15px]">
        <dt className="self-center text-xs font-extrabold tracking-widest text-muted uppercase">
          {t('battle.item')}
        </dt>
        <dd className="font-bold">{pokemon.item || '—'}</dd>
        <dt className="self-center text-xs font-extrabold tracking-widest text-muted uppercase">
          {t('battle.ability')}
        </dt>
        <dd className="font-bold">{pokemon.ability}</dd>
        <dt className="self-center text-xs font-extrabold tracking-widest text-muted uppercase">
          {t('battle.hp')}
        </dt>
        <dd className="font-bold">
          {t('battle.hpValue', { hp: pokemon.hp, maxhp: pokemon.maxhp })}
        </dd>
      </dl>
      <ul className="grid grid-cols-2 gap-1.5">
        {pokemon.moves.map((move) => (
          <li
            key={move.id}
            style={typeStyle(move.type)}
            className={cn(
              'type-chip justify-between rounded-xl px-2.5 py-2 text-[13px] tracking-normal normal-case',
              isLightType(move.type) && 'type-chip--light',
            )}
          >
            {move.name}
          </li>
        ))}
      </ul>
      <div className="sheet__actions">
        <Button variant="ghost" onClick={onClose} className="min-h-13.5 text-[17px]">
          {t('common.close')}
        </Button>
        <Button
          variant="primary"
          disabled={!canSwitch}
          onClick={onSwitch}
          className="min-h-13.5 text-[17px]"
        >
          {label}
        </Button>
      </div>
    </Sheet>
  );
}

interface ForfeitSheetProps {
  onClose: () => void;
  onForfeit: () => void;
}

export function ForfeitSheet({ onClose, onForfeit }: ForfeitSheetProps) {
  const { t } = useTranslation();
  return (
    <Sheet title={t('battle.forfeitTitle')} onClose={onClose}>
      <p className="text-[15px] leading-normal text-ink-2">{t('battle.forfeitBody')}</p>
      <div className="sheet__actions">
        <Button variant="ghost" onClick={onClose} className="min-h-13.5 text-[17px]">
          {t('battle.keepPlaying')}
        </Button>
        <Button variant="primary" onClick={onForfeit} className="min-h-13.5 text-[17px]">
          {t('battle.forfeit')}
        </Button>
      </div>
    </Sheet>
  );
}
