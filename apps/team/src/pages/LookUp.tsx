import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { TeamSession } from '@oa/types';
import { Banner, Button, Card, Field, Row, Spinner } from '@oa/ui';
import { api } from '../api';
import { useTimezone } from '../event';
import { TeamShell } from '../shell';

interface Found {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  passCode: string;
  type: string;
  zone: { letter: string; name: string } | null;
  trip: { code: string; pickupPoint: { name: string } } | null;
  checkIns: Array<{ stage: string; createdAt: string; method: string }>;
}

/** GT-5: an usher settles a question about one person. */
export function LookUp({ session }: { session: TeamSession }) {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const timezone = useTimezone(session.eventId);

  const result = useQuery({
    queryKey: ['look-up', session.eventId, submitted],
    queryFn: () =>
      api.get<Found>(`/checkins/look-up/${session.eventId}?q=${encodeURIComponent(submitted)}`),
    enabled: !!session.eventId && submitted.length >= 2,
    retry: false,
  });

  const boarded = result.data?.checkIns.find((checkIn) => checkIn.stage === 'BOARDED');
  const arrived = result.data?.checkIns.find((checkIn) => checkIn.stage === 'ARRIVED');

  const when = (iso: string) =>
    new Intl.DateTimeFormat('en-NG', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(iso));

  return (
    <TeamShell session={session} title="Look up">
      <Field
        label="Name, pass code or email"
        value={query}
        placeholder="Ada Okafor, or UR-4K7Q"
        autoComplete="off"
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') setSubmitted(query.trim());
        }}
      />
      <Button onClick={() => setSubmitted(query.trim())} disabled={query.trim().length < 2}>
        Look up
      </Button>

      <div className="mt-oa-3">
        {result.isFetching ? <Spinner label="Looking" /> : null}
        {result.isError ? (
          <Banner tone="warn">
            We cannot find this pass. Please send them to the walk-in lane.
          </Banner>
        ) : null}

        {result.data ? (
          <Card>
            <p className="oa-display mb-oa-2 text-[28px] leading-none">{result.data.fullName}</p>
            <Row label="Pass code" value={result.data.passCode} />
            <Row label="Coming as" value={result.data.type.toLowerCase().replace('_', '-')} />
            {result.data.trip ? <Row label="Trip" value={result.data.trip.code} /> : null}
            {result.data.trip ? (
              <Row label="Pickup" value={result.data.trip.pickupPoint.name} />
            ) : null}
            <Row
              label="Zone"
              value={
                result.data.zone
                  ? `Zone ${result.data.zone.letter}, ${result.data.zone.name}`
                  : 'Given at check-in'
              }
            />
            <Row label="Boarded" value={boarded ? when(boarded.createdAt) : 'No'} />
            <Row label="Arrived" value={arrived ? when(arrived.createdAt) : 'No'} />
          </Card>
        ) : null}
      </div>
    </TeamShell>
  );
}
