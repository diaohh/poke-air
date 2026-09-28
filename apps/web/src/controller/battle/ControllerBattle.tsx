import type { BattleFieldSlot, BattlePokemon, BattleRequest } from '@poke-air/shared';
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
import {
  moveAction,
  stepsOf,
  summarize,
  switchOptions,
  targetChoices,
  type DecisionStep,
  type SwitchOption,
  type TargetChoice,
} from './choice';
import { ForfeitSheet, MoveSheet, PokemonSheet } from './sheets';

/**
 * Phone BATTLE (WP6, 3DS lower-screen model). Shows only this player's own data:
 * - no menu yet → "look at the big screen" (the Host is animating the turn),
 * - `wait` request → the others are choosing (or all the player's Pokémon are out),
 * - choice sent → summary + Undo,
 * - otherwise the decision: one step per position the player controls (Phase 3: a solo doubles
 *   player decides two), each FIGHT (→ target in doubles) / Pokémon, or a forced switch.
 */
export function ControllerBattle() {
  const battle = useControllerStore((s) => s.battle);
  const request = battle?.request ?? null;

  if (!request) return <WatchScreen starting={!battle} />;
  if (request.kind === 'wait') return <OthersChoosing request={request} />;
  if (battle?.choice) return <WaitingView request={request} choice={battle.choice} />;
  // A new request id resets the menu state (step, view, selection, Mega toggle).
  return <Decision key={request.rqid} request={request} />;
}

/** The player shares the side with a teammate (2v2 / the pair of a 1v2). */
function useHasTeammate(): boolean {
  const room = useControllerStore((s) => s.room);
  const playerId = useControllerStore((s) => s.playerId);
  const me = room?.players.find((p) => p.id === playerId);
  return Boolean(me && room && room.players.filter((p) => p.team === me.team).length > 1);
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

function OthersChoosing({ request }: { request: BattleRequest }) {
  const { t } = useTranslation();
  const teammate = useHasTeammate();
  const out = request.pokemon.length > 0 && request.pokemon.every((p) => p.fainted);
  return (
    <Centered>
      <PokeBall size={96} tone={out ? 'team' : 'brand'} animation={out ? 'bounce' : 'spin'} />
      <p className="text-lg font-bold text-ink-2">
        {out
          ? t('battle.allFainted')
          : teammate
            ? t('battle.othersChoosing')
            : t('battle.opponentChoosing')}
      </p>
    </Centered>
  );
}

function WaitingView({ request, choice }: { request: BattleRequest; choice: string }) {
  const { t } = useTranslation();
  const { undo, busy, error } = useControllerStore();
  const teammate = useHasTeammate();
  const summaries = summarize(request, choice);
  const bold = { b: <span className="text-wine" /> };

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="phone-card flex flex-col items-center gap-2 rounded-[22px] p-5 text-center">
        <span className="field-label text-xs">{t('battle.yourChoice')}</span>
        {summaries.map((summary, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <p className="text-xl font-extrabold">
              {summary.kind === 'move' &&
                (summary.target ? (
                  <Trans
                    i18nKey="battle.choiceMoveTarget"
                    values={{
                      pokemon: summary.pokemon,
                      move: summary.move,
                      target: summary.target,
                    }}
                    components={bold}
                  />
                ) : (
                  <Trans
                    i18nKey="battle.choiceMove"
                    values={{ pokemon: summary.pokemon, move: summary.move }}
                    components={bold}
                  />
                ))}
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
              <span className="tag tag--mega text-[11px]">{t('battle.megaTag')}</span>
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center font-bold text-ink-2">
        <PokeBall size={96} tone="brand" animation="spin" />
        {teammate ? t('battle.waitingOthers') : t('battle.waitingOpponent')}
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

type View = 'menu' | 'fight' | 'target' | 'party';
type OpenSheet =
  { kind: 'move'; index: number } | { kind: 'pokemon'; index: number } | { kind: 'forfeit' } | null;

function Decision({ request }: { request: BattleRequest }) {
  const { t } = useTranslation();
  const { choose, forfeit, busy, error } = useControllerStore();
  const teammate = useHasTeammate();
  const steps = stepsOf(request);
  const [stepIndex, setStepIndex] = useState(0);
  /** Actions of the steps already decided (sent together after the last one). */
  const [actions, setActions] = useState<string[]>([]);
  const step = steps[stepIndex];
  const [view, setView] = useState<View>(step?.kind === 'switch' ? 'party' : 'menu');
  const [selected, setSelected] = useState<number | null>(null);
  const [megaToggle, setMega] = useState(false);
  const [targetMove, setTargetMove] = useState<number | null>(null);
  const [sheet, setSheet] = useState<OpenSheet>(null);

  if (!step) return null;
  const option = step.option;
  const moves = option?.moves ?? [];
  const sheetMove = sheet?.kind === 'move' ? moves[sheet.index] : undefined;
  const party = switchOptions(request, step, actions);
  const sheetOption = sheet?.kind === 'pokemon' ? party[sheet.index] : undefined;
  // One Mega Evolution per team per turn: locked when the ally or an earlier position has it.
  const megaEarlier = actions.some((action) => action.endsWith(' mega'));
  const megaLocked = request.allyMega || megaEarlier;
  const mega = megaToggle && !megaLocked && Boolean(option?.canMegaEvo);

  const goTo = (index: number, done: string[]) => {
    setActions(done);
    setStepIndex(index);
    setView(steps[index]?.kind === 'switch' ? 'party' : 'menu');
    setSelected(null);
    setMega(false);
    setTargetMove(null);
    setSheet(null);
  };
  /** This step's action is decided: next step, or send everything. */
  const complete = (action: string) => {
    const done = [...actions, action];
    if (stepIndex + 1 < steps.length) {
      goTo(stepIndex + 1, done);
      return;
    }
    setSheet(null);
    void choose(done.join(', '));
  };
  const previous = stepIndex > 0 ? () => goTo(stepIndex - 1, actions.slice(0, -1)) : undefined;

  const pickMove = (index: number) => {
    const move = moves[index];
    if (!move) return;
    const choices = targetChoices(request, step.position, move);
    const standing = choices.filter((choice) => choice.slot && !choice.slot.fainted);
    // No target step for spread / self moves, nor when only one target is left standing.
    if (choices.length === 0) complete(moveAction(index, undefined, mega));
    else if (standing.length <= 1) {
      complete(moveAction(index, (standing[0] ?? choices[0])?.loc, mega));
    } else {
      setSheet(null);
      setTargetMove(index);
      setView('target');
    }
  };
  const tapMove = (index: number) => {
    if (selected === index) pickMove(index);
    else setSelected(index);
  };
  const ally = request.field.own.find((slot, position) => position !== step.position && slot);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3.5">
      {view === 'menu' && step.pokemon && (
        <>
          <ActiveCard pokemon={step.pokemon} ally={ally ?? null} />
          <p className="text-center text-[17px] font-extrabold">
            {steps.length > 1 && (
              <span className="mr-2 rounded-full bg-paper px-2.5 py-1 text-[13px] text-(color:--deep) shadow-lift">
                {t('battle.stepOf', { step: stepIndex + 1, total: steps.length })}
              </span>
            )}
            {t('battle.prompt', { pokemon: step.pokemon.name })}
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
            {previous ? (
              <button
                type="button"
                onClick={previous}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-ink-2 hover:bg-paper/70"
              >
                <Icon name="back" />
                {t('battle.previousStep', { pokemon: steps[stepIndex - 1]?.pokemon?.name ?? '' })}
              </button>
            ) : (
              <span />
            )}
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
          {option?.canMegaEvo && (
            <>
              <button
                type="button"
                role="switch"
                aria-checked={mega}
                disabled={megaLocked}
                onClick={() => setMega((on) => !on)}
                className={cn(
                  'mega-toggle min-h-13 px-3.5 py-2.5',
                  mega && 'mega-toggle--on',
                  megaLocked && 'opacity-50',
                )}
              >
                <span className="flex items-center gap-2.5">
                  <span className="mega-stone size-7.5 text-[30px]" />
                  {t('battle.mega')}
                </span>
                <span className="mega-toggle__switch" />
              </button>
              {megaLocked && (
                <p className="-mt-2 text-[13px] font-semibold text-ink-2">
                  {request.allyMega ? t('battle.megaAllyLocked') : t('battle.megaOnePerTurn')}
                </p>
              )}
            </>
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

      {view === 'target' && targetMove !== null && moves[targetMove] && (
        <TargetView
          move={moves[targetMove]?.name ?? ''}
          choices={targetChoices(request, step.position, moves[targetMove])}
          onBack={() => setView('fight')}
          onPick={(loc) => complete(moveAction(targetMove, loc, mega))}
        />
      )}

      {view === 'party' && (
        <PartyList
          step={step}
          request={request}
          options={party}
          onBack={step.kind === 'switch' ? previous : () => setView('menu')}
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
          onUse={() => pickMove(sheet.index)}
        />
      )}
      {sheetOption && (
        <PokemonSheet
          pokemon={sheetOption.pokemon}
          canSwitch={sheetOption.allowed}
          onClose={() => setSheet(null)}
          onSwitch={() => complete(`switch ${sheetOption.slot}`)}
        />
      )}
      {sheet?.kind === 'forfeit' && (
        <ForfeitSheet
          team={teammate}
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

function NavRow({ title, onBack }: { title: string; onBack?: (() => void) | undefined }) {
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

/** The acting Pokémon (exact HP) + in doubles the other Pokémon on the player's side (public %). */
function ActiveCard({ pokemon, ally }: { pokemon: BattlePokemon; ally: BattleFieldSlot | null }) {
  const { t } = useTranslation();
  const percent = pokemon.maxhp ? Math.round((pokemon.hp / pokemon.maxhp) * 100) : 0;
  return (
    <div className="phone-card flex flex-col gap-2 rounded-[22px] px-3.5 py-3">
      <div className="flex items-center gap-3">
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
      {ally && (
        <p className="flex items-center gap-2 border-t border-canvas-deep pt-2 text-[13px] font-bold text-ink-2">
          <span className="grid size-7 shrink-0 place-items-center overflow-hidden">
            <PokemonSprite species={ally.species} decorative fit />
          </span>
          <span className="min-w-0 flex-1 truncate">
            {t('battle.allyLine', { pokemon: ally.name })}
          </span>
          <span className="tabular-nums">{ally.fainted ? t('battle.fainted') : `${ally.hp}%`}</span>
        </p>
      )}
    </div>
  );
}

interface TargetViewProps {
  move: string;
  choices: TargetChoice[];
  onBack: () => void;
  onPick: (loc: number) => void;
}

/**
 * Doubles target step (docs/12-design-system.md § Controller): the opponents' row, then the
 * player's side (the ally allowed but flagged ⚠, the user itself only for moves like Acupressure),
 * left → right as on the TV. Empty or fainted positions can't be picked.
 */
function TargetView({ move, choices, onBack, onPick }: TargetViewProps) {
  const { t } = useTranslation();
  const rows = [
    { key: 'foe', title: t('battle.targetFoes'), choices: choices.filter((c) => c.side === 'foe') },
    { key: 'own', title: t('battle.targetOwn'), choices: choices.filter((c) => c.side === 'own') },
  ].filter((row) => row.choices.length > 0);

  return (
    <>
      <NavRow title={t('battle.chooseTarget', { move })} onBack={onBack} />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pt-1 pb-2">
        {rows.map((row) => (
          <section key={row.key} className="flex flex-col gap-2">
            <h3 className="field-label text-xs">{row.title}</h3>
            <div className="grid grid-cols-2 gap-2.5">
              {row.choices.map((choice) => {
                const { slot } = choice;
                const disabled = !slot || slot.fainted;
                return (
                  <button
                    key={choice.loc}
                    type="button"
                    disabled={disabled}
                    onClick={() => onPick(choice.loc)}
                    className={cn(
                      'party-row flex min-h-32 flex-col items-center justify-center gap-1.5 rounded-[22px] p-3 text-center',
                      disabled && 'party-row--fainted',
                    )}
                  >
                    <span className="grid size-14 place-items-center overflow-hidden">
                      {slot && <PokemonSprite species={slot.species} decorative fit />}
                    </span>
                    <strong className="w-full truncate text-base font-extrabold">
                      {slot?.name ?? '—'}
                    </strong>
                    {slot && !slot.fainted && <HpBar percent={slot.hp} className="h-2 w-full" />}
                    {choice.side === 'own' && slot && !slot.fainted && (
                      <span className="tag text-[10px]">
                        {choice.self ? t('battle.targetSelf') : t('battle.targetAlly')}
                      </span>
                    )}
                    {slot?.fainted && (
                      <span className="tag tag--fainted text-[10px]">{t('battle.fainted')}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

interface PartyListProps {
  step: DecisionStep;
  request: BattleRequest;
  options: SwitchOption[];
  onBack: (() => void) | undefined;
  onOpen: (index: number) => void;
}

function PartyList({ step, request, options, onBack, onOpen }: PartyListProps) {
  const { t } = useTranslation();
  const forced = step.kind === 'switch';
  const trapped = step.kind === 'move' && step.option?.trapped;
  const doubles = request.activePerSide > 1;
  return (
    <>
      <NavRow title={forced ? t('battle.forcedSwitch') : t('battle.yourPokemon')} onBack={onBack} />
      {(forced || trapped) && (
        <p className="text-sm font-semibold text-ink-2">
          {trapped
            ? t('battle.trapped')
            : doubles && step.pokemon
              ? t('battle.replaceHint', { pokemon: step.pokemon.name })
              : t('battle.forcedSwitchHint')}
        </p>
      )}
      <div className="-mx-1.5 flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-1.5 pt-1 pb-2">
        {options.map(({ pokemon, allowed }, index) => {
          const percent = pokemon.maxhp ? (pokemon.hp / pokemon.maxhp) * 100 : 0;
          const picked = !allowed && !pokemon.active && !pokemon.fainted && !trapped;
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
              ) : picked ? (
                <span className="tag text-[11px]">{t('battle.picked')}</span>
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
