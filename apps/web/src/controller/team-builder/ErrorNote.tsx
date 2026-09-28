import type { ErrorCode, ErrorPayload } from '@poke-air/shared';
import { useTranslation } from 'react-i18next';

interface Props {
  error: ErrorCode | 'CONNECTION' | undefined;
  params: ErrorPayload['params'];
}

/**
 * A translated error (`errors.<code>`, interpolated with its params). `INVALID_SET` also shows
 * Showdown's validator lines, which are English only (decision D-38).
 */
export function ErrorNote({ error, params }: Props) {
  const { t } = useTranslation();
  if (!error) return null;
  const details = typeof params?.details === 'string' ? params.details : '';
  return (
    <div role="alert" className="text-center text-sm font-semibold text-warn-deep">
      <p>{t(`errors.${error}`, { species: '', ...params })}</p>
      {details && (
        <p className="mt-1 text-xs font-medium whitespace-pre-line text-ink-2">{details}</p>
      )}
    </div>
  );
}
