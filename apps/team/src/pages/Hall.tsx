import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LiveSnapshot, TeamSession, ZoneFill } from '@oa/types';
import { Banner, Button, Card, Select, Spinner } from '@oa/ui';
import { api } from '../api';
import { TeamShell } from '../shell';

/** ZN-3: zone fill in real time, with the two moves an usher can make. */
export function Hall({ session }: { session: TeamSession }) {
  const queryClient = useQueryClient();
  const [moving, setMoving] = useState<ZoneFill | null>(null);

  const live = useQuery({
    queryKey: ['live', session.eventId],
    queryFn: () => api.get<LiveSnapshot>(`/events/${session.eventId}/live`),
    enabled: !!session.eventId,
    refetchInterval: 10_000,
  });

  const setClosed = useMutation({
    mutationFn: ({ zoneId, closed }: { zoneId: string; closed: boolean }) =>
      api.post(`/zones/${zoneId}/closed`, { closed }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['live'] }),
  });

  const moveTrip = useMutation({
    mutationFn: ({ zoneId, tripId }: { zoneId: string; tripId: string }) =>
      api.post<{ moved: number }>(`/zones/${zoneId}/move-trip`, { tripId }),
    onSuccess: () => {
      setMoving(null);
      void queryClient.invalidateQueries({ queryKey: ['live'] });
    },
  });

  if (live.isLoading) {
    return (
      <TeamShell session={session} title="The hall">
        <Spinner label="Loading the hall" />
      </TeamShell>
    );
  }

  const snapshot = live.data;

  return (
    <TeamShell session={session} title="The hall">
      {snapshot ? (
        <p className="mb-oa-3 text-[16px]">
          <strong>{snapshot.totals.inHall}</strong> seated · {snapshot.totals.onTheWay} on the way
        </p>
      ) : null}

      {moveTrip.isSuccess ? (
        <Banner>Moved. The pass of everyone on that trip now shows the new zone.</Banner>
      ) : null}

      <div className="grid gap-oa-2">
        {(snapshot?.zones ?? []).map((zone) => (
          <Card key={zone.id}>
            <div className="mb-oa-2 flex items-center justify-between gap-oa-3">
              <span className="flex items-center gap-oa-2">
                <span
                  className="oa-display flex h-12 w-12 items-center justify-center rounded-oa-md text-[28px] text-oa-on-gold"
                  style={{ background: zone.color }}
                >
                  {zone.letter}
                </span>
                <span>
                  <span className="block text-[16px] font-semibold">{zone.name}</span>
                  <span className="block text-[13px] text-oa-ink-muted">
                    {zone.inHall} of {zone.capacity}
                    {zone.closed ? ' · closed' : ''}
                  </span>
                </span>
              </span>
              <span className="oa-display text-[32px] leading-none">
                {Math.round(zone.fill * 100)}%
              </span>
            </div>

            <div
              className="mb-oa-3 h-3 w-full overflow-hidden rounded-oa-sm bg-oa-surface-muted"
              role="progressbar"
              aria-valuenow={Math.round(zone.fill * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Zone ${zone.letter} fill`}
            >
              <div
                className="h-full"
                style={{
                  width: `${Math.round(zone.fill * 100)}%`,
                  background: zone.fill > 0.9 ? 'var(--oa-status-stop)' : zone.color,
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-oa-2">
              <Button
                variant="quiet"
                loading={setClosed.isPending && setClosed.variables?.zoneId === zone.id}
                onClick={() => setClosed.mutate({ zoneId: zone.id, closed: !zone.closed })}
              >
                {zone.closed ? 'Reopen' : 'Close'}
              </Button>
              <Button variant="quiet" onClick={() => setMoving(zone)}>
                Move a trip here
              </Button>
            </div>

            {moving?.id === zone.id ? (
              <div className="mt-oa-3">
                <Select
                  label={`Move a trip into Zone ${zone.letter}`}
                  defaultValue=""
                  onChange={(event) => {
                    if (event.target.value) {
                      moveTrip.mutate({ zoneId: zone.id, tripId: event.target.value });
                    }
                  }}
                >
                  <option value="">Choose a trip</option>
                  {(snapshot?.trips ?? []).map((trip) => (
                    <option key={trip.id} value={trip.id}>
                      Trip {trip.code} — {trip.pickupPointName} ({trip.boardedCount})
                    </option>
                  ))}
                </Select>
                <Button variant="quiet" onClick={() => setMoving(null)}>
                  Cancel
                </Button>
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </TeamShell>
  );
}
