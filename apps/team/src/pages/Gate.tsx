import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TeamSession, TripSummary } from '@oa/types';
import { Banner, Button, Card, Spinner, clock, relative } from '@oa/ui';
import { api, postDurable } from '../api';
import { useTimezone } from '../event';
import { TeamShell } from '../shell';

/**
 * GT-1: the usher watches for buses and confirms a whole trip with one tap.
 * Under a minute per arriving trip is the target, so arrival is one button
 * and nothing else.
 */
export function Gate({ session }: { session: TeamSession }) {
  const queryClient = useQueryClient();
  const timezone = useTimezone(session.eventId);
  const [justDone, setJustDone] = useState<{ code: string; arrived: number } | null>(null);

  const trips = useQuery({
    queryKey: ['trips', session.eventId, 'gate'],
    queryFn: () =>
      api.get<TripSummary[]>(`/events/${session.eventId}/trips?status=DEPARTED,ARRIVED,BOARDING`),
    enabled: !!session.eventId,
    refetchInterval: 15_000,
  });

  const confirm = useMutation({
    mutationFn: async (trip: TripSummary) => {
      const sent = await postDurable(`/trips/${trip.id}/arrive`, {}, `Arrive ${trip.code}`);
      return { trip, sent };
    },
    onSuccess: ({ trip }) => {
      setJustDone({ code: trip.code, arrived: trip.boardedCount });
      void queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });

  const onTheWay = (trips.data ?? []).filter((trip) => trip.status === 'DEPARTED');
  const boarding = (trips.data ?? []).filter((trip) => trip.status === 'BOARDING');
  const arrived = (trips.data ?? []).filter((trip) => trip.status === 'ARRIVED');

  return (
    <TeamShell session={session} title="The gate">
      {justDone ? (
        <Banner>
          Trip {justDone.code} confirmed. {justDone.arrived} people marked arrived.
        </Banner>
      ) : null}

      {trips.isLoading ? <Spinner label="Loading trips" /> : null}

      <h2 className="oa-label mb-oa-2">On the way ({onTheWay.length})</h2>
      <div className="mb-oa-4 grid gap-oa-2">
        {onTheWay.map((trip) => (
          <Card key={trip.id}>
            <div className="mb-oa-2 flex items-baseline justify-between gap-oa-2">
              <span className="oa-display text-[32px] leading-none">Trip {trip.code}</span>
              <span className="oa-display text-[32px] leading-none">{trip.boardedCount}</span>
            </div>
            <p className="mb-oa-3 text-[15px] text-oa-ink-muted">
              {trip.pickupPointName}
              {trip.delegateFirstName ? ` · ${trip.delegateFirstName}` : ''} · left{' '}
              {relative(trip.departsAt)}
            </p>
            <Button
              loading={confirm.isPending && confirm.variables?.id === trip.id}
              onClick={() => confirm.mutate(trip)}
            >
              Confirm arrival
            </Button>
          </Card>
        ))}
        {onTheWay.length === 0 && !trips.isLoading ? (
          <p className="text-[15px] text-oa-ink-muted">No buses on the way right now.</p>
        ) : null}
      </div>

      {boarding.length > 0 ? (
        <>
          <h2 className="oa-label mb-oa-2">Still boarding ({boarding.length})</h2>
          <div className="mb-oa-4 grid gap-oa-2">
            {boarding.map((trip) => (
              <Card key={trip.id}>
                <div className="flex items-baseline justify-between gap-oa-2">
                  <span className="text-[18px] font-semibold">Trip {trip.code}</span>
                  <span className="text-[16px]">{trip.boardedCount} on board</span>
                </div>
                <p className="text-[13px] text-oa-ink-muted">
                  {trip.pickupPointName} · leaves {clock(trip.departsAt, timezone)}
                </p>
              </Card>
            ))}
          </div>
        </>
      ) : null}

      <h2 className="oa-label mb-oa-2">Arrived ({arrived.length})</h2>
      <div className="grid gap-oa-2">
        {arrived.map((trip) => (
          <Card key={trip.id}>
            <div className="flex items-baseline justify-between gap-oa-2">
              <span className="text-[18px] font-semibold">Trip {trip.code}</span>
              <span className="text-[16px]">{trip.boardedCount} in</span>
            </div>
            <p className="text-[13px] text-oa-ink-muted">{trip.pickupPointName}</p>
          </Card>
        ))}
        {arrived.length === 0 && !trips.isLoading ? (
          <p className="text-[15px] text-oa-ink-muted">Nothing has arrived yet.</p>
        ) : null}
      </div>
    </TeamShell>
  );
}
