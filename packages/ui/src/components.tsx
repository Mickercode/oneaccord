import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';
import { clock, dayMonth, monthYear } from './format';
import { Logo } from './logo';

function join(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

/** One primary action per screen, in fire, 56px tall. */
export function Button({
  variant = 'primary',
  full = true,
  loading = false,
  children,
  className,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'quiet' | 'danger';
  full?: boolean;
  loading?: boolean;
}) {
  const base =
    'inline-flex items-center justify-center gap-oa-2 rounded-oa-md px-oa-4 font-oa-body text-[16px] font-bold transition-opacity disabled:opacity-50';
  const look = {
    primary: 'bg-oa-fire text-oa-on-fire min-h-[56px]',
    quiet: 'bg-transparent text-oa-ink border-2 border-oa-border min-h-[48px]',
    danger: 'bg-transparent text-oa-fire-ink border-2 border-oa-fire min-h-[48px]',
  }[variant];

  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={join(base, look, full && 'w-full', className)}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-oa-2" role="status" aria-live="polite">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      {label ? <span>{label}</span> : <span className="sr-only">Working</span>}
    </span>
  );
}

export function Field({
  label,
  hint,
  error,
  id,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  const inputId = id ?? `field-${label.toLowerCase().replace(/\W+/g, '-')}`;
  return (
    <div className="mb-oa-3">
      <label htmlFor={inputId} className="oa-label mb-oa-1 block">
        {label}
      </label>
      <input
        {...rest}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        className={join(
          'w-full rounded-oa-md border-2 bg-oa-surface px-oa-3 py-oa-2 text-[16px] text-oa-ink',
          error ? 'border-oa-fire' : 'border-oa-border',
        )}
      />
      {hint && !error ? (
        <p id={`${inputId}-hint`} className="mt-oa-1 text-[13px] text-oa-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${inputId}-error`} className="mt-oa-1 text-[13px] font-semibold text-oa-fire-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Select({
  label,
  hint,
  error,
  id,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string; error?: string }) {
  const selectId = id ?? `select-${label.toLowerCase().replace(/\W+/g, '-')}`;
  return (
    <div className="mb-oa-3">
      <label htmlFor={selectId} className="oa-label mb-oa-1 block">
        {label}
      </label>
      <select
        {...rest}
        id={selectId}
        className={join(
          'w-full rounded-oa-md border-2 bg-oa-surface px-oa-3 py-oa-2 text-[16px] text-oa-ink',
          error ? 'border-oa-fire' : 'border-oa-border',
        )}
      >
        {children}
      </select>
      {hint && !error ? <p className="mt-oa-1 text-[13px] text-oa-ink-muted">{hint}</p> : null}
      {error ? <p className="mt-oa-1 text-[13px] font-semibold text-oa-fire-ink">{error}</p> : null}
    </div>
  );
}

export function Checkbox({
  label,
  id,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  const boxId = id ?? `check-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <label htmlFor={boxId} className="mb-oa-3 flex min-h-[48px] items-start gap-oa-2">
      <input
        {...rest}
        id={boxId}
        type="checkbox"
        className="mt-1 h-6 w-6 min-h-0 shrink-0 accent-[color:var(--oa-fire)]"
      />
      <span className="text-[15px] leading-[22px]">{label}</span>
    </label>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={join('rounded-oa-lg border border-oa-border bg-oa-surface p-oa-3', className)}>
      {children}
    </div>
  );
}

export function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-oa-3 border-b border-oa-border py-oa-2 last:border-0">
      <span className="oa-label">{label}</span>
      <span className="text-right text-[16px] font-semibold text-oa-ink">{value}</span>
    </div>
  );
}

/**
 * The signature date strip: day in ink, month in fire-ink, time in a fire box.
 * On Night the box is gold.
 */
export function DateStrip({
  iso,
  timezone,
  night = false,
}: {
  iso: string;
  timezone: string;
  night?: boolean;
}) {
  return (
    <p className="mb-oa-3 flex flex-wrap items-center gap-oa-2">
      <span className="oa-wide text-[18px] text-oa-ink">{dayMonth(iso, timezone)}</span>
      <span className="oa-wide text-[18px] text-oa-fire-ink">{monthYear(iso, timezone)}</span>
      <span
        className={join(
          'oa-wide rounded-oa-sm px-oa-2 py-1 text-[18px]',
          night ? 'bg-oa-gold text-oa-on-gold' : 'bg-oa-fire text-oa-on-fire',
        )}
      >
        {clock(iso, timezone)}
      </span>
    </p>
  );
}

/** The slanted city tab from the flyers. */
export function CityTab({ city, color }: { city: string; color: string }) {
  return (
    <span
      className="oa-wide inline-block -skew-x-12 px-oa-3 py-1 text-[13px] text-oa-ink"
      style={{ background: color }}
    >
      <span className="inline-block skew-x-12">{city}</span>
    </span>
  );
}

export function ZoneTag({
  letter,
  name,
  color,
  size = 'md',
}: {
  letter: string;
  name?: string;
  color: string;
  size?: 'md' | 'lg';
}) {
  return (
    <span className="inline-flex items-center gap-oa-2">
      <span
        className={join(
          'oa-display flex items-center justify-center rounded-oa-md text-oa-ink',
          size === 'lg' ? 'h-20 w-20 text-[48px]' : 'h-12 w-12 text-[28px]',
        )}
        style={{ background: color }}
      >
        {letter}
      </span>
      {name ? <span className="text-[16px] font-semibold">{name}</span> : null}
    </span>
  );
}

/**
 * The full-screen result an usher or attendee reads at a glance. The three
 * fills never change between cities.
 */
export function StatusScreen({
  tone,
  headline,
  detail,
  children,
}: {
  tone: 'go' | 'check' | 'stop';
  headline: string;
  detail?: ReactNode;
  children?: ReactNode;
}) {
  const background = {
    go: 'var(--oa-status-go)',
    check: 'var(--oa-status-check)',
    stop: 'var(--oa-status-stop)',
  }[tone];
  const ink = tone === 'check' ? '#141414' : '#FFFFFF';

  return (
    <section
      className="flex min-h-[100dvh] flex-col justify-center px-oa-4 py-oa-5"
      style={{ background, color: ink }}
      role="status"
      aria-live="assertive"
    >
      <p className="oa-display text-[clamp(40px,12vw,64px)] leading-[0.95]">{headline}</p>
      {detail ? <div className="mt-oa-3 text-[18px] leading-[26px]">{detail}</div> : null}
      {children ? <div className="mt-oa-4">{children}</div> : null}
    </section>
  );
}

export function PageShell({
  city,
  cityColor,
  children,
  footer,
}: {
  city?: string;
  cityColor?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[560px] flex-col px-oa-3 py-oa-4">
      <header className="mb-oa-4 flex items-center justify-between gap-oa-3">
        <Logo width={150} />
        {city && cityColor ? <CityTab city={city} color={cityColor} /> : null}
      </header>
      <main className="flex-1">{children}</main>
      {footer ? <footer className="mt-oa-4 text-[13px] text-oa-ink-muted">{footer}</footer> : null}
    </div>
  );
}

/** The space the Upper Room team drops their own logo into. */
export function UpperRoomLogoSlot({ className }: { className?: string }) {
  return (
    <div
      className={join(
        'oa-label flex h-12 items-center justify-center rounded-oa-sm border border-dashed border-oa-border text-oa-ink-muted',
        className,
      )}
      aria-hidden="true"
    >
      [Upper Room logo]
    </div>
  );
}

export function Banner({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'warn' | 'error';
  children: ReactNode;
}) {
  const look = {
    info: 'border-oa-border bg-oa-surface-muted text-oa-ink',
    warn: 'border-[color:var(--oa-status-check)] bg-oa-surface-muted text-oa-ink',
    error: 'border-oa-fire bg-oa-surface-muted text-oa-fire-ink',
  }[tone];
  return (
    <div
      className={join('mb-oa-3 rounded-oa-md border-2 px-oa-3 py-oa-2 text-[15px]', look)}
      role="alert"
    >
      {children}
    </div>
  );
}
