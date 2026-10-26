import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { BreakdownRow, EventSummary, LiveSnapshot, TeamSession, TripSummary } from '@oa/types';
import { Button, Card, Spinner, clock, relative } from '@oa/ui';
import { api, apiBase } from '../api';
import { useLive } from '../socket';
import { AdminShell, Stat } from '../shell';

const TRIP_LABEL: Record<TripSummary['status'], string> = {
  SCHEDULED: 'Not started',
  BOARDING: 'Boarding',
  DEPARTED: 'On the way',
  ARRIVED: 'Arrived',
};

type GroupBy = 'pickup' | 'campus' | 'area' | 'city';

/** DB-1 to DB-4: what the team watches during the gathering. */
export function Dashboard({ session }: { session: TeamSession }) {
  const { eventId = '' } = useParams();
  const [groupBy, setGroupBy] = useState<GroupBy>('pickup');

  const event = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => api.get<{ event: EventSummary }>(`/events/${eventId}/public`),
  });

  const initial = useQuery({
    queryKey: ['live', eventId],
    queryFn: () => api.get<LiveSnapshot>(`/events/${eventId}/live`),
  });

  const { snapshot, connected } = useLive(eventId, initial.data);

  const breakdown = useQuery({
    queryKey: ['breakdown', eventId, groupBy],
    queryFn: () => api.get<BreakdownRow[]>(`/events/${eventId}/breakdown?by=${groupBy}`),
    refetchInterval: 60_000,
  });

  const timezone = event.data?.event.timezone ?? 'Africa/Lagos';

  if (!snapshot) {
    return (
      <AdminShell session={session} title="Live">
        <Spinner label="Loading the gathering" />
      </AdminShell>
    );
  }

  const { totals, trips, zones } = snapshot;
  const turnout =
    totals.registered > 0 ? Math.round((totals.arrived / totals.registered) * 100) : 0;

  return (
    <AdminShell
      session={session}
      title="Live"
      event={event.data?.event}
      right={
        <div className="flex items-center gap-oa-2">
          <span
            className="oa-label rounded-oa-sm px-oa-2 py-1"
            style={{
              background: connected ? 'var(--oa-status-go)' : 'var(--oa-status-check)',
              color: connected ? '#FFFFFF' : '#141414',
            }}
          >
            {connected ? 'Live' : 'Reconnecting'}
          </span>
          {/* DB-4 */}
          <a
            className="oa-label flex min-h-[44px] items-center rounded-oa-md border-2 border-oa-border px-oa-3"
            href={`${apiBase}/events/${eventId}/export`}
          >
            Export CSV
          </a>
        </div>
      }
    >
      <section className="mb-oa-4 grid grid-cols-2 gap-oa-2 md:grid-cols-5">
        <Stat label="Registered" value={totals.registered} />
        <Stat label="Boarded" value={totals.boarded} tone="gold" />
        <Stat label="On the way" value={totals.onTheWay} tone="fire" />
        <Stat label="Arrived" value={totals.arrived} tone="go" />
        <Stat label="Turnout" value={`${turnout}%`} />
      </section>

      <section className="mb-oa-4">
        <h2 className="oa-label mb-oa-2">Zones</h2>
        <div className="grid gap-oa-2 md:grid-cols-2 lg:grid-cols-4">
          {zones.map((zone) => (
            <Card key={zone.id}>
              <div className="mb-oa-2 flex items-center justify-between">
                <span className="flex items-center gap-oa-2">
                  <span
                    className="oa-display flex h-10 w-10 items-center justify-center rounded-oa-md text-[24px] text-oa-on-gold"
                    style={{ background: zone.color }}
                  >
                    {zone.letter}
                  </span>
                  <span className="text-[15px] font-semibold">{zone.name}</span>
                </span>
                <span className="oa-display text-[24px]">{Math.round(zone.fill * 100)}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-oa-sm bg-oa-surface-muted">
                <div
                  className="h-full"
                  style={{
                    width: `${Math.round(zone.fill * 100)}%`,
                    background: zone.fill > 0.9 ? 'var(--oa-status-stop)' : zone.color,
                  }}
                />
              </div>
              <p className="mt-oa-1 text-[13px] text-oa-ink-muted">
                {zone.inHall} of {zone.capacity}
                {zone.closed ? ' · closed' : ''}
              </p>
            </Card>
          ))}
        </div>
      </section>

      {/* DB-2 */}
      <section className="mb-oa-4">
        <h2 className="oa-label mb-oa-2">Trips</h2>
        <div className="overflow-x-auto rounded-oa-lg border border-oa-border">
          <table className="w-full border-collapse text-left text-[15px]">
            <thead>
              <tr className="border-b border-oa-border">
                {['Trip', 'Pickup', 'Delegate', 'Leaves', 'On board', 'Status'].map((head) => (
                  <th key={head} className="oa-label px-oa-3 py-oa-2">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trips.map((trip) => (
                <tr key={trip.id} className="border-b border-oa-border last:border-0">
                  <td className="px-oa-3 py-oa-2 font-semibold">{trip.code}</td>
                  <td className="px-oa-3 py-oa-2">{trip.pickupPointName}</td>
                  <td className="px-oa-3 py-oa-2">{trip.delegateFirstName ?? '—'}</td>
                  <td className="px-oa-3 py-oa-2">{clock(trip.departsAt, timezone)}</td>
                  <td className="px-oa-3 py-oa-2">
                    {trip.boardedCount}
                    <span className="text-oa-ink-muted">/{trip.capacity}</span>
                  </td>
                  <td className="px-oa-3 py-oa-2">
                    <span className="oa-label">{TRIP_LABEL[trip.status]}</span>
                    {trip.status === 'DEPARTED' ? (
                      <span className="ml-oa-2 text-[13px] text-oa-ink-muted">
                        left {relative(trip.departsAt)}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* DB-3 */}
      <section>
        <div className="mb-oa-2 flex flex-wrap items-center gap-oa-2">
          <h2 className="oa-label">Attendance by</h2>
          {(
            [
              ['pickup', 'Pickup point'],
              ['campus', 'Campus'],
              ['area', 'Area'],
              ['city', 'City'],
            ] as Array<[GroupBy, string]>
          ).map(([value, label]) => (
            <Button
              key={value}
              full={false}
              variant={groupBy === value ? 'primary' : 'quiet'}
              onClick={() => setGroupBy(value)}
            >
              {label}
            </Button>
          ))}
        </div>

        <div className="overflow-x-auto rounded-oa-lg border border-oa-border">
          <table className="w-full border-collapse text-left text-[15px]">
            <thead>
              <tr className="border-b border-oa-border">
                {['Name', 'Registered', 'Boarded', 'Arrived', 'Turnout'].map((head) => (
                  <th key={head} className="oa-label px-oa-3 py-oa-2">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(breakdown.data ?? []).map((row) => (
                <tr key={row.key} className="border-b border-oa-border last:border-0">
                  <td className="px-oa-3 py-oa-2 font-semibold">{row.label}</td>
                  <td className="px-oa-3 py-oa-2">{row.registered}</td>
                  <td className="px-oa-3 py-oa-2">{row.boarded}</td>
                  <td className="px-oa-3 py-oa-2">{row.arrived}</td>
                  <td className="px-oa-3 py-oa-2">
                    {row.registered > 0
                      ? `${Math.round((row.arrived / row.registered) * 100)}%`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
