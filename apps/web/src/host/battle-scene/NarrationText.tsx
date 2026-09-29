import { Trans, useTranslation } from 'react-i18next';
import { useDexNames } from '../../lib/dex-names';
import type { Narration } from './model';

/**
 * One narration line (`battle.log.*`, our own keys in every locale, D-58) with its names
 * localized: Pokémon, moves, abilities, items and effects arrive in English from the protocol and
 * are shown in the room language; stats use the narration's own stat names ("el Ataque" in
 * Spanish). `<b>` marks move and item names.
 */
export function NarrationText({ line }: { line: Narration }) {
  const { t } = useTranslation();
  const names = useDexNames();
  const values = { ...line.params };
  const text = (key: string) => (typeof values[key] === 'string' ? (values[key] as string) : null);
  const pokemon = text('pokemon');
  if (pokemon) values.pokemon = names.species(pokemon);
  const move = text('move');
  if (move) values.move = names.move(move);
  const ability = text('ability');
  if (ability) values.ability = names.ability(ability);
  const item = text('item');
  if (item) values.item = names.item(item);
  const effect = text('effect');
  if (effect) values.effect = names.effect(effect);
  const stat = text('stat');
  if (stat) values.stat = t(`battle.log.stats.${stat as 'atk'}`);
  return (
    <Trans
      i18nKey={`battle.log.${line.key}`}
      values={values}
      components={{ b: <b className="font-extrabold" /> }}
    />
  );
}
