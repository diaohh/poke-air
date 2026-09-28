import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';
import { Icon, type IconName } from './Icon';

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: IconName;
  /** Accessible name, also shown as a tooltip. */
  label: string;
  /** Turns scarlet on hover (destructive actions like kick/remove). */
  danger?: boolean;
  /** Paper card with lift (Host header). */
  raised?: boolean;
}

/** Square icon-only button, 44 px by default (minimum tap target). */
export function IconButton({ icon, label, danger, raised, className, ...rest }: Props) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'icon-btn',
        danger && 'icon-btn--danger',
        raised && 'icon-btn--raised',
        className,
      )}
      {...rest}
    >
      <Icon name={icon} />
    </button>
  );
}
