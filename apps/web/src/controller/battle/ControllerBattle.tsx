import type { BattlePokemon, BattleRequest } from '@poke-air/shared';
import { useState, type ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { PokemonSprite } from '../../components/PokemonSprite';
import { Button } from '../../components/ui/Button';
import { HpBar } from '../../components/ui/HpBar';
import { Icon } from '../../components/ui/Icon';
import { PokeBall } from '../../components/ui/PokeBall';
import { cn } from '../../lib/cn';
import { isLightType, typeStyle } from '../../lib/pokemon-types';
import { useControllerStore } from '../controller-store';
import { activeOf, summarize, switchOptions } from './choice';
import { ForfeitSheet, MoveSheet, PokemonSheet } from './sheets';

/**
 * Phone BATTLE (WP6, 3DS lower-screen model). Shows only this player's own data:
 * - no menu yet → "look at the big screen" (the Host is animating the turn),
 * - `wait` request → the other trainer is choosing,
 * - choice sent → summary + Undo,
 * - otherwise the decision: FIGHT / Pokémon, or a forced switch.
 */
export function ControllerBattle() {
  const battle = useControllerStore((s) => s.battle);
  const request = battle?.request ?? null;

  if (!request) return <WatchScreen starting={!battle} />;
  if (request.kind === 'wait') return <OpponentChoosing />;
  if (battle?.choice) return <WaitingView request={request} choice={battle.choice} />;
  // A new request id resets the menu state (view, selection, Mega toggle).
  return <Decision key={request.rqid} request={request} />;
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-4 text-center">
      {children}
    </div>
  );
}

function WatchScreen({ starting }: { starting: boolean }) {
  const { t } = useTranslation();
  return (
    <Centered>
      <PokeBall size={88} tone="team" animation="bounce" />
      <p className="font-display text-[30px] leading-tight">
        {starting ? t('battle.starting') : t('battle.watchScreen')}
      </p>
      <p className="text-[15px] font-semibold text-ink-2">{t('battle.watchHint')}</p>
    </Centered>
  );
}

function OpponentChoosing() {
  const { t } = useTranslation();
  return (
    <Centered>
      <PokeBall size={96} tone="brand" animation="spin" />
      <p className="text-lg font-bold text-ink-2">{t('battle.opponentChoosing')}</p>
    </Centered>
  );
}

function WaitingView({ request, choice }: { request: BattleRequest; choice: string }) {
  const { t } = useTranslation();
  const { undo, busy, error } = useControllerStore();
  const summary = summarize(request, choice);
  const bold = { b: <span className="text-wine" /> };

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="phone-card flex flex-col items-center gap-2 rounded-[22px] p-5 text-center">
        <span className="field-label text-xs">{t('battle.yourChoice')}</span>
        <p className="text-xl font-extrabold">
          {summary.kind === 'move' && (
            <Trans
              i18nKey="battle.choiceMove"
              values={{ pokemon: summary.pokemon, move: summary.move }}
              components={bold}
            />
          )}
          {summary.kind === 'switch' && (
            <Trans
              i18nKey="battle.choiceSwitch"
              values={{ pokemon: summary.pokemon }}
              components={bold}
            />
          )}
          {summary.kind === 'default' && t('battle.choiceDefault')}
        </p>
        {summary.kind === 'move' && summary.mega && (
          <span className="tag tag--mega mt-1 text-[11px]">{t('battle.megaTag')}</span>
        )}
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center font-bold text-ink-2">
        <PokeBall size={96} tone="brand" animation="spin" />
        {t('battle.waitingOpponent')}
      </div>
      {error && (
        <p role="alert" className="text-center text-sm font-semibold text-warn-deep">
          {t(`errors.${error}`)}
        </p>
      )}
      <Button
        variant="ghost"
        disabled={busy}
        onClick={() => void undo()}
        className="min-h-15 w-full text-[19px]"
      >
        <Icon name="undo" />
        {t('battle.undo')}
      </Button>
    </div>
  );
}

type View = 'menu' | 'fight' | 'party';
type OpenSheet =
  { kind: 'move'; index: number } | { kind: 'pokemon'; index: number } | { kind: 'forfeit' } | null;

function Decision({ request }: { request: BattleRequest }) {
  const { t } = useTranslation();
  const { choose, forfeit, busy, error } = useControllerStore();
  const forced = request.kind === 'switch';
  const [view, setView] = useState<View>(forced ? 'party' : 'menu');
  const [selected, setSelected] = useState<number | null>(null);
  const [mega, setMega] = useState(false);
  const [sheet, setSheet] = useState<OpenSheet>(null);
  const active = activeOf(request);
  const options = request.active[0];
  const moves = options?.moves ?? [];
  const sheetMove = sheet?.kind === 'move' ? moves[sheet.index] : undefined;

  const sendMove = (index: number) => {
    setSheet(null);
    void choose(`move ${index + 1}${mega && options?.canMegaEvo ? ' mega' : ''}`);
  };
  const tapMove = (index: number) => {
    if (selected === index) sendMove(index);
    else setSelected(index);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3.5">
      {view === 'menu' && active && (
        <>
          <ActiveCard pokemon={active} />
          <p className="text-center text-[17px] font-extrabold">
            {t('battle.prompt', { pokemon: active.name })}
          </p>
          <button
            type="button"
            onClick={() => setView('fight')}
            className="big-fight grid min-h-0 flex-3 place-items-center rounded-[30px] font-display text-[58px] tracking-wide"
          >
            {t('battle.fight')}
          </button>
          <Button
            variant="gold"
            onClick={() => setView('party')}
            className="min-h-0 flex-2 rounded-[30px] font-display text-[40px] font-normal"
          >
            {t('battle.pokemon')}
          </Button>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setSheet({ kind: 'forfeit' })}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-ink-2 hover:bg-paper/70"
            >
              <Icon name="flag" />
              {t('battle.forfeit')}
            </button>
          </div>
        </>
      )}

      {view === 'fight' && (
        <>
          <NavRow title={t('battle.chooseMove')} onBack={() => setView('menu')} />
          {options?.canMegaEvo && (
            <button
              type="button"
              role="switch"
              aria-checked={mega}
              onClick={() => setMega((on) => !on)}
              className={cn('mega-toggle min-h-13 px-3.5 py-2.5', mega && 'mega-toggle--on')}
            >
              <span className="flex items-center gap-2.5">
                <span className="mega-stone size-7.5 text-[30px]" />
                {t('battle.mega')}
              </span>
              <span className="mega-toggle__switch" />
            </button>
          )}
          <div className="-mx-1.5 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1.5 pt-3.5 pb-2">
            {moves.map((move, index) => (
              <button
                key={move.id}
                type="button"
                disabled={move.disabled || busy}
                onClick={() => tapMove(index)}
                style={typeStyle(move.type)}
                aria-pressed={selected === index}
                className={cn(
                  'move-btn min-h-17 shrink-0 pr-4 pl-4.5',
                  isLightType(move.type) && 'move-btn--light',
                  selected === index && 'move-btn--selected',
                )}
              >
                {selected === index && (
                  <span className="move-btn__again">{t('battle.tapAgain')}</span>
                )}
                <strong className="flex-1 text-xl leading-tight font-extrabold">{move.name}</strong>
                <span className="move-btn__type">
                  {t(`types.${move.type as 'Normal'}`, { defaultValue: move.type })}
                </span>
                <em className="min-w-13 text-right text-[15px] font-extrabold not-italic tabular-nums">
                  {move.maxpp ? `${move.pp}/${move.maxpp}` : ''}
                </em>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-[auto_1fr] items-center gap-3">
            <Button
              variant="ghost"
              disabled={selected === null}
              onClick={() => selected !== null && setSheet({ kind: 'move', index: selected })}
              className="min-h-13 px-4.5 text-base"
            >
              <Icon name="info" />
              {t('battle.details')}
            </Button>
            <p className="text-[13px] leading-snug text-ink-2">
              {selected === null ? (
                t('battle.selectHint')
              ) : (
                <Trans
                  i18nKey="battle.useHint"
                  values={{ move: moves[selected]?.name ?? '' }}
                  components={{ b: <b /> }}
                />
              )}
            </p>
          </div>
        </>
      )}

      {view === 'party' && (
        <PartyList
          request={request}
          forced={forced}
          onBack={() => setView('menu')}
          onOpen={(index) => setSheet({ kind: 'pokemon', index })}
        />
      )}

      {error && (
        <p role="alert" className="text-center text-sm font-semibold text-warn-deep">
          {t(`errors.${error}`)}
        </p>
      )}

      {sheetMove && sheet?.kind === 'move' && (
        <MoveSheet
          move={sheetMove}
          onClose={() => setSheet(null)}
          onUse={() => sendMove(sheet.index)}
        />
      )}
      {sheet?.kind === 'pokemon' && (
        <PokemonSheetFor
          request={request}
          index={sheet.index}
          onClose={() => setSheet(null)}
          onSwitch={(slot) => {
            setSheet(null);
            void choose(`switch ${slot}`);
          }}
        />
      )}
      {sheet?.kind === 'forfeit' && (
        <ForfeitSheet
          onClose={() => setSheet(null)}
          onForfeit={() => {
            setSheet(null);
            void forfeit();
          }}
        />
      )}
    </div>
  );
}

function NavRow({ title, onBack }: { title: string; onBack?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2.5">
      {onBack && (
        <button
          type="button"
          aria-label={t('common.back')}
          onClick={onBack}
          className="grid size-12 shrink-0 place-items-center rounded-2xl bg-paper text-[22px] shadow-lift"
        >
          <Icon name="back" />
        </button>
      )}
      <h2 className="flex-1 font-display text-2xl leading-tight">{title}</h2>
    </div>
  );
}

function StatusTag({ pokemon }: { pokemon: BattlePokemon }) {
  const { t } = useTranslation();
  if (pokemon.fainted)
    return <span className="tag tag--fainted text-[11px]">{t('battle.fainted')}</span>;
  if (pokemon.status) {
    return (
      <span className={`tag tag--${pokemon.status} text-[11px]`}>
        {t(`statuses.${pokemon.status}`)}
      </span>
    );
  }
  return null;
}

function ActiveCard({ pokemon }: { pokemon: BattlePokemon }) {
  const { t } = useTranslation();
  const percent = pokemon.maxhp ? Math.round((pokemon.hp / pokemon.maxhp) * 100) : 0;
  return (
    <div className="phone-card flex items-center gap-3 rounded-[22px] px-3.5 py-3">
      <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-(color:--tint)">
        <PokemonSprite species={pokemon.species} decorative fit />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <strong className="truncate text-[19px] font-extrabold">{pokemon.name}</strong>
          <span className="flex shrink-0 items-center gap-1.5 text-xs font-extrabold text-muted">
            <StatusTag pokemon={pokemon} />
            {t('battle.level', { level: pokemon.level })}
          </span>
        </div>
        <HpBar percent={percent} className="mt-1.75 h-2.5" />
        <div className="mt-1.25 flex justify-between text-xs font-bold text-ink-2">
          <span>{t('battle.hpValue', { hp: pokemon.hp, maxhp: pokemon.maxhp })}</span>
          <span>{percent}%</span>
        </div>
      </div>
    </div>
  );
}

interface PartyListProps {
  request: BattleRequest;
  forced: boolean;
  onBack: () => void;
  onOpen: (index: number) => void;
}

function PartyList({ request, forced, onBack, onOpen }: PartyListProps) {
  const { t } = useTranslation();
  const trapped = request.kind === 'move' && request.active[0]?.trapped;
  return (
    <>
      <NavRow
        title={forced ? t('battle.forcedSwitch') : t('battle.yourPokemon')}
        {...(forced ? {} : { onBack })}
      />
      {(forced || trapped) && (
        <p className="text-sm font-semibold text-ink-2">
          {trapped ? t('battle.trapped') : t('battle.forcedSwitchHint')}
        </p>
      )}
      <div className="-mx-1.5 flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-1.5 pt-1 pb-2">
        {request.pokemon.map((pokemon, index) => {
          const percent = pokemon.maxhp ? (pokemon.hp / pokemon.maxhp) * 100 : 0;
          return (
            <button
              key={pokemon.ident}
              type="button"
              onClick={() => onOpen(index)}
              className={cn(
                'party-row flex w-full shrink-0 items-center gap-3 rounded-[22px] p-3 text-left',
                pokemon.fainted && 'party-row--fainted',
              )}
            >
              <div className="grid size-12 shrink-0 place-items-center overflow-hidden">
                <PokemonSprite species={pokemon.species} decorative fit />
              </div>
              <div className="min-w-0 flex-1">
                <strong className="block truncate text-[17px] font-extrabold">
                  {pokemon.name}
                </strong>
                <HpBar percent={percent} className="mt-1.5 h-2.5" />
                <span className="mt-1 block text-xs font-bold text-ink-2">
                  {t('battle.hpValue', { hp: pokemon.hp, maxhp: pokemon.maxhp })}
                </span>
              </div>
              {pokemon.active ? (
                <span className="tag tag--active text-[11px]">{t('battle.inBattle')}</span>
              ) : (
                <StatusTag pokemon={pokemon} />
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

function PokemonSheetFor({
  request,
  index,
  onClose,
  onSwitch,
}: {
  request: BattleRequest;
  index: number;
  onClose: () => void;
  onSwitch: (slot: number) => void;
}) {
  const option = switchOptions(request)[index];
  if (!option) return null;
  return (
    <PokemonSheet
      pokemon={option.pokemon}
      canSwitch={option.allowed}
      onClose={onClose}
      onSwitch={() => onSwitch(option.slot)}
    />
  );
}
