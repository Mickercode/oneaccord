import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { TeamSession, TripSummary } from '@oa/types';
import { Button, Card, Spinner, clock, relative } from '@oa/ui';
import { api } from '../api';
import { useTimezone } from '../event';
import { TeamShell } from '../shell';

const LABEL: Record<TripSummary['status'], string> = {
  SCHEDULED: 'Not started',
  BOARDING: 'Boarding',
  DEPARTED: 'On the way',
  ARRIVED: 'Arrived',
};

/** Where a delegate lands: their own trips, soonest first. */
export function Trips({ session }: { session: TeamSession }) {
  const navigate = useNavigate();
  const timezone = useTimezone(session.eventId);

  const trips = useQuery({
    queryKey: ['trips', 'mine'],
    queryFn: () => api.get<TripSummary[]>('/trips/mine'),
    refetchInterval: 30_000,
  });

  return (
    <TeamShell session={session} title="Your trips">
      {trips.isLoading ? <Spinner label="Loading your trips" /> : null}

      <div className="grid gap-oa-2">
        {(trips.data ?? []).map((trip) => (
          <Card key={trip.id}>
            <div className="mb-oa-2 flex items-baseline justify-between gap-oa-2">
              <span className="oa-display text-[28px] leading-none">Trip {trip.code}</span>
              <span className="oa-label">{LABEL[trip.status]}</span>
            </div>
            <p className="mb-oa-2 text-[15px] text-oa-ink-muted">
              {trip.pickupPointName} · leaves {clock(trip.departsAt, timezone)} (
              {relative(trip.departsAt)})
            </p>
            <p className="mb-oa-3 text-[16px]">
              <strong>{trip.boardedCount}</strong> of {trip.capacity} boarded
            </p>
            <Button
              variant={
                trip.status === 'DEPARTED' || trip.status === 'ARRIVED' ? 'quiet' : 'primary'
              }
              onClick={() => navigate(`/trips/${trip.id}`)}
            >
              {trip.status === 'DEPARTED' || trip.status === 'ARRIVED'
                ? 'See the list'
                : 'Show the code'}
            </Button>
          </Card>
        ))}
      </div>

      {trips.data?.length === 0 ? (
        <p className="text-[15px] text-oa-ink-muted">
          You have no trips today. If that looks wrong, ask an admin to check your pickup point.
        </p>
      ) : null}
    </TeamShell>
  );
}
