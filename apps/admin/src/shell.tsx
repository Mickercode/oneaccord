import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import type { EventSummary, TeamSession } from '@oa/types';
import { CityTab, DateStrip } from '@oa/ui';
import { api } from './api';

/** The dashboard frame: bold top, calm rows below. */
export function AdminShell({
  session,
  title,
  event,
  children,
  tabs = true,
  right,
}: {
  session: TeamSession;
  title: string;
  event?: EventSummary;
  children: ReactNode;
  tabs?: boolean;
  right?: ReactNode;
}) {
  const navigate = useNavigate();

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[1100px] flex-col px-oa-3 py-oa-4">
      <header className="mb-oa-4">
        <div className="mb-oa-2 flex flex-wrap items-center justify-between gap-oa-2">
          <NavLink to="/" className="oa-label">
            One Accord
          </NavLink>
          <div className="flex items-center gap-oa-3">
            <span className="text-[13px] text-oa-ink-muted">
              {session.fullName} · {session.role.toLowerCase().replace('_', ' ')}
            </span>
            <button
              type="button"
              className="oa-label min-h-[44px] underline"
              onClick={async () => {
                await api.post('/auth/sign-out').catch(() => undefined);
                navigate('/sign-in');
                window.location.reload();
              }}
            >
              Sign out
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-oa-3">
          <div>
            <h1 className="oa-display text-[clamp(32px,6vw,64px)] leading-[0.95]">{title}</h1>
            {event ? (
              <>
                <div className="mt-oa-2 flex items-center gap-oa-2">
                  <CityTab city={event.city} color={event.cityColor} />
                  <span className="text-[15px] text-oa-ink-muted">{event.venue}</span>
                </div>
                <div className="mt-oa-2">
                  <DateStrip iso={event.startsAt} timezone={event.timezone} night />
                </div>
              </>
            ) : null}
          </div>
          {right}
        </div>

        {event && tabs ? (
          <nav className="mt-oa-3 flex gap-oa-2 overflow-x-auto">
            {(
              [
                [`/events/${event.id}`, 'Live'],
                [`/events/${event.id}/setup`, 'Setup'],
                [`/events/${event.id}/messages`, 'Messages'],
              ] as Array<[string, string]>
            ).map(([to, label]) => (
              <NavLink
                key={to}
                to={to}
                end
                className={({ isActive }) =>
                  `oa-label flex min-h-[44px] items-center rounded-oa-md border-2 px-oa-3 ${
                    isActive ? 'border-oa-fire text-oa-ink' : 'border-oa-border text-oa-ink-muted'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        ) : null}
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}

export function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: 'fire' | 'gold' | 'go';
}) {
  const color =
    tone === 'fire'
      ? 'var(--oa-fire)'
      : tone === 'gold'
        ? 'var(--oa-gold)'
        : tone === 'go'
          ? 'var(--oa-status-go)'
          : 'var(--oa-ink)';
  return (
    <div className="rounded-oa-lg border border-oa-border bg-oa-surface p-oa-3">
      <p className="oa-label mb-oa-1">{label}</p>
      <p className="oa-display text-[clamp(32px,5vw,48px)] leading-none" style={{ color }}>
        {typeof value === 'number' ? value.toLocaleString('en-NG') : value}
      </p>
    </div>
  );
}
