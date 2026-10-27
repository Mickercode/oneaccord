import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import type { TeamSession } from '@oa/types';
import { Logo } from '@oa/ui';
import { api, sendQueued } from './api';
import { useOfflineQueue } from './offline';

const post = (path: string, body?: unknown) => api.post(path, body);

/** The dark frame every team screen sits in, with the offline badge. */
export function TeamShell({
  session,
  title,
  children,
  action,
}: {
  session: TeamSession;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  const navigate = useNavigate();
  const { online, pending } = useOfflineQueue(post);
  const isUsher = session.role === 'USHER';
  const isAdmin = session.role === 'ADMIN' || session.role === 'SUPER_ADMIN';

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[640px] flex-col px-oa-3 py-oa-3">
      <header className="mb-oa-3 flex items-center justify-between gap-oa-2">
        <div className="flex items-center gap-oa-2">
          <Logo variant="mark" width={36} />
          <div>
            <p className="oa-label">One Accord</p>
            <h1 className="oa-display text-[28px] leading-none">{title}</h1>
          </div>
        </div>
        <div className="flex items-center gap-oa-2">
          {!online || pending > 0 ? (
            <span
              className="oa-label rounded-oa-sm px-oa-2 py-1"
              style={{
                background: online ? 'var(--oa-status-check)' : 'var(--oa-status-stop)',
                color: online ? '#141414' : '#FFFFFF',
              }}
              role="status"
            >
              {online ? `Syncing ${pending}` : `Offline${pending ? ` · ${pending}` : ''}`}
            </span>
          ) : null}
          <button
            type="button"
            className="oa-label min-h-[44px] underline"
            onClick={async () => {
              await sendQueued().catch(() => undefined);
              await api.post('/auth/sign-out').catch(() => undefined);
              navigate('/sign-in');
              window.location.reload();
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      {(isUsher || isAdmin) && (
        <nav className="mb-oa-3 flex gap-oa-2 overflow-x-auto">
          {(
            [
              ['/gate', 'Gate'],
              ['/hall', 'Hall'],
              ['/look-up', 'Look up'],
              ...(isAdmin ? [['/trips', 'Trips']] : []),
            ] as Array<[string, string]>
          ).map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
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
      )}

      <main className="flex-1">{children}</main>
      {action ? (
        <div className="sticky bottom-0 mt-oa-3 bg-oa-ground pb-oa-2 pt-oa-2">{action}</div>
      ) : null}
    </div>
  );
}
