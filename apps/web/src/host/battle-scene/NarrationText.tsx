import { Trans, useTranslation } from 'react-i18next';
import type { Narration } from './model';

/** One narration line (`battle.log.*`), with stat names translated and `<b>` for move names. */
export function NarrationText({ line }: { line: Narration }) {
  const { t } = useTranslation();
  const values = { ...line.params };
  if (typeof values.stat === 'string') values.stat = t(`stats.${values.stat as 'atk'}`);
  return (
    <Trans
      i18nKey={`battle.log.${line.key}`}
      values={values}
      components={{ b: <b className="font-extrabold" /> }}
    />
  );
}
