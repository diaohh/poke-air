import { cn } from '../../lib/cn';

interface Props {
  /** 0–100. */
  percent: number;
  className?: string;
}

/** HP bar: green > 50%, yellow ≤ 50%, scarlet ≤ 20%. Height via className (default 10 px). */
export function HpBar({ percent, className }: Props) {
  const clamped = Math.max(0, Math.min(100, percent));
  const level = clamped <= 20 ? 'low' : clamped <= 50 ? 'mid' : undefined;
  return (
    <div className={cn('hp-bar', className ?? 'h-2.5')}>
      <i
        className={cn('hp-bar__fill', level && `hp-bar__fill--${level}`)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
