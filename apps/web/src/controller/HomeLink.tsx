import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Icon } from '../components/ui/Icon';

/**
 * "Back to the home page" for a phone that is not seated (join form, removed / room closed): the
 * way out to join another room or open the team builder.
 */
export function HomeLink() {
  const { t } = useTranslation();
  return (
    <Link
      to="/"
      className="inline-flex min-h-11 items-center justify-center gap-1.5 self-center rounded-xl px-3 text-sm font-bold text-ink-2 hover:bg-paper/70"
    >
      <Icon name="back" />
      {t('controller.home')}
    </Link>
  );
}
