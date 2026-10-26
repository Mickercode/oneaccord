import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import type { BoardedAttendee, BoardingCodeResponse, TeamSession } from '@oa/types';
import { ApiError, Banner, Button, Card, Field, Spinner, clock } from '@oa/ui';
import { api, postDurable } from '../api';
import { useTimezone } from '../event';
import { useTripCount } from '../socket';
import { TeamShell } from '../shell';

interface ManifestRow {
  registrationId: string;
  fullName: string;
  passCode: string;
  phone: string | null;
  zoneLetter: string | null;
  boarded: boolean;
}

type Panel = 'code' | 'by-name' | 'walk-in' | 'boarded';

/** BD-1 to BD-8: the delegate's screen on the bus. */
export function Boarding({ session }: { session: TeamSession }) {
  const { tripId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [panel, setPanel] = useState<Panel>('code');
  const timezone = useTimezone(session.eventId);

  const code = useQuery({
    queryKey: ['boarding-code', tripId],
    queryFn: () => api.get<BoardingCodeResponse>(`/trips/${tripId}/boarding-code`),
    // The code is only good for 60 seconds; never serve a stale one.
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  const liveCount = useTripCount(tripId, code.data?.boardedCount ?? 0);

  // BD-1: ask for the next code the moment this one stops being current.
  useEffect(() => {
    const rotatesAt = code.data?.rotatesAt;
    if (!rotatesAt) return;
    const delay = Math.max(1_000, rotatesAt * 1000 - Date.now() + 250);
    const timer = setTimeout(() => code.refetch(), delay);
    return () => clearTimeout(timer);
  }, [code.data?.rotatesAt, code]);

  const depart = useMutation({
    mutationFn: () => postDurable(`/trips/${tripId}/depart`, {}, `Depart ${code.data?.trip.code}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['trips'] });
      navigate('/trips');
    },
  });

  if (code.isLoading) {
    return (
      <TeamShell session={session} title="Boarding">
        <Spinner label="Loading the trip" />
      </TeamShell>
    );
  }

  if (code.isError) {
    const failure = code.error instanceof ApiError ? code.error : null;
    return (
      <TeamShell session={session} title="Boarding">
        <Banner tone="error">{failure?.message ?? 'We cannot open that trip.'}</Banner>
        <Button variant="quiet" onClick={() => navigate('/trips')}>
          Back to your trips
        </Button>
      </TeamShell>
    );
  }

  const trip = code.data!.trip;

  return (
    <TeamShell
      session={session}
      title={`Trip ${trip.code}`}
      action={
        panel === 'code' ? (
          <Button
            variant="danger"
            loading={depart.isPending}
            onClick={() => {
              if (confirm(`Mark Trip ${trip.code} departed with ${liveCount} on board?`)) {
                depart.mutate();
              }
            }}
          >
            Mark departed
          </Button>
        ) : (
          <Button variant="quiet" onClick={() => setPanel('code')}>
            Back to the code
          </Button>
        )
      }
    >
      <div className="mb-oa-3 flex items-baseline justify-between">
        <p className="text-[15px] text-oa-ink-muted">
          {trip.pickupPointName} · leaves {clock(trip.departsAt, timezone)}
        </p>
        <p className="oa-display text-[40px] leading-none" aria-live="polite">
          {liveCount}
          <span className="text-[18px] text-oa-ink-muted">/{trip.capacity}</span>
        </p>
      </div>

      {panel === 'code' ? (
        <CodePanel url={code.data!.url} rotatesAt={code.data!.rotatesAt} />
      ) : null}
      {panel === 'by-name' ? <ByNamePanel tripId={tripId} eventId={session.eventId} /> : null}
      {panel === 'walk-in' ? <WalkInPanel tripId={tripId} /> : null}
      {panel === 'boarded' ? <BoardedPanel tripId={tripId} /> : null}

      {panel === 'code' ? (
        <div className="mt-oa-3 grid grid-cols-3 gap-oa-2">
          {(
            [
              ['by-name', 'By name'],
              ['walk-in', 'Walk-in'],
              ['boarded', 'Boarded'],
            ] as Array<[Panel, string]>
          ).map(([value, label]) => (
            <Button key={value} variant="quiet" onClick={() => setPanel(value)}>
              {label}
            </Button>
          ))}
        </div>
      ) : null}
    </TeamShell>
  );
}

/** BD-1: a code that changes every 30 seconds, big enough to scan from a seat. */
function CodePanel({ url, rotatesAt }: { url: string; rotatesAt: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [left, setLeft] = useState(() => Math.max(0, rotatesAt - Math.floor(Date.now() / 1000)));

  useEffect(() => {
    if (!canvas.current) return;
    void QRCode.toCanvas(canvas.current, url, {
      width: 1024,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#121212', light: '#FFFFFF' },
    });
  }, [url]);

  useEffect(() => {
    const tick = () => setLeft(Math.max(0, rotatesAt - Math.floor(Date.now() / 1000)));
    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [rotatesAt]);

  return (
    <div>
      <div className="rounded-oa-lg bg-white p-oa-3">
        <canvas ref={canvas} className="h-auto w-full" aria-label="Boarding code" />
      </div>
      <p className="mt-oa-2 text-center text-[15px] text-oa-ink-muted" aria-live="off">
        New code in {left}s. Hold the phone up and let everyone scan.
      </p>
    </div>
  );
}

/** BD-5: no phone, so the delegate finds them and taps. */
function ByNamePanel({ tripId, eventId }: { tripId: string; eventId: string | null }) {
  const [query, setQuery] = useState('');
  const [done, setDone] = useState<Record<string, boolean>>({});
  const queryClient = useQueryClient();

  const manifest = useQuery({
    queryKey: ['manifest', tripId],
    queryFn: () => api.get<ManifestRow[]>(`/trips/${tripId}/manifest`),
  });

  const search = useQuery({
    queryKey: ['search', eventId, query],
    queryFn: () =>
      api.get<
        Array<{ id: string; fullName: string; passCode: string; trip: { code: string } | null }>
      >(`/events/${eventId}/registrations/search?q=${encodeURIComponent(query)}&tripId=${tripId}`),
    enabled: !!eventId && query.trim().length >= 2,
  });

  const checkIn = useMutation({
    mutationFn: (registrationId: string) =>
      postDurable('/checkins/by-name', { tripId, registrationId }, `Check in ${registrationId}`),
    onSuccess: (_result, registrationId) => {
      setDone((current) => ({ ...current, [registrationId]: true }));
      void queryClient.invalidateQueries({ queryKey: ['manifest', tripId] });
    },
  });

  const rows = useMemo(() => {
    if (query.trim().length >= 2 && search.data) {
      return search.data.map((row) => ({
        registrationId: row.id,
        fullName: row.fullName,
        passCode: row.passCode,
        otherTrip: row.trip?.code ?? null,
        boarded: false,
      }));
    }
    return (manifest.data ?? [])
      .filter((row) => !row.boarded)
      .map((row) => ({
        registrationId: row.registrationId,
        fullName: row.fullName,
        passCode: row.passCode,
        otherTrip: null,
        boarded: row.boarded,
      }));
  }, [manifest.data, search.data, query]);

  return (
    <Card>
      <Field
        label="Search a name or pass code"
        value={query}
        placeholder="Ada, or UR-4K7Q"
        autoComplete="off"
        onChange={(event) => setQuery(event.target.value)}
      />
      {manifest.isLoading ? <Spinner label="Loading the list" /> : null}
      <ul className="divide-y divide-oa-border">
        {rows.slice(0, 40).map((row) => (
          <li
            key={row.registrationId}
            className="flex items-center justify-between gap-oa-2 py-oa-2"
          >
            <div>
              <p className="text-[16px] font-semibold">{row.fullName}</p>
              <p className="text-[13px] text-oa-ink-muted">
                {row.passCode}
                {row.otherTrip ? ` · booked on Trip ${row.otherTrip}` : ''}
              </p>
            </div>
            <Button
              full={false}
              variant={done[row.registrationId] ? 'quiet' : 'primary'}
              disabled={done[row.registrationId]}
              loading={checkIn.isPending && checkIn.variables === row.registrationId}
              onClick={() => checkIn.mutate(row.registrationId)}
            >
              {done[row.registrationId] ? 'Done' : 'Check in'}
            </Button>
          </li>
        ))}
        {rows.length === 0 && !manifest.isLoading ? (
          <li className="py-oa-3 text-[15px] text-oa-ink-muted">
            {query ? 'Nobody by that name.' : 'Everyone on the list has boarded.'}
          </li>
        ) : null}
      </ul>
    </Card>
  );
}

/** BD-5: someone who never registered, added to this bus if there is a seat. */
function WalkInPanel({ tripId }: { tripId: string }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const add = useMutation({
    mutationFn: () =>
      api.post(`/trips/${tripId}/attendees`, {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
      }),
    onSuccess: () => {
      setFullName('');
      setEmail('');
      setPhone('');
    },
  });

  const failure = add.error instanceof ApiError ? add.error : null;

  return (
    <Card>
      <p className="mb-oa-3 text-[15px] text-oa-ink-muted">
        Add someone to this bus. Their UR Pass follows by email.
      </p>
      {failure ? <Banner tone="error">{failure.message}</Banner> : null}
      {add.isSuccess ? <Banner>Added and checked in.</Banner> : null}
      <Field
        label="Full name"
        value={fullName}
        onChange={(event) => setFullName(event.target.value)}
      />
      <Field
        label="Email"
        type="email"
        inputMode="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <Field
        label="Phone (optional)"
        type="tel"
        inputMode="tel"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
      />
      <Button
        loading={add.isPending}
        disabled={fullName.trim().length < 2 || !/.+@.+\..+/.test(email)}
        onClick={() => add.mutate()}
      >
        Add to this trip
      </Button>
    </Card>
  );
}

function BoardedPanel({ tripId }: { tripId: string }) {
  const boarded = useQuery({
    queryKey: ['boarded', tripId],
    queryFn: () => api.get<BoardedAttendee[]>(`/trips/${tripId}/boarded`),
    refetchInterval: 10_000,
  });

  return (
    <Card>
      {boarded.isLoading ? <Spinner label="Loading" /> : null}
      <ul className="divide-y divide-oa-border">
        {(boarded.data ?? []).map((row) => (
          <li
            key={row.registrationId}
            className="flex items-center justify-between gap-oa-2 py-oa-2"
          >
            <div>
              <p className="text-[16px] font-semibold">{row.fullName}</p>
              <p className="text-[13px] text-oa-ink-muted">
                {row.passCode}
                {row.method === 'BY_NAME' ? ' · by name' : ''}
              </p>
            </div>
            {row.zoneLetter ? (
              <span className="oa-display text-[24px]">Zone {row.zoneLetter}</span>
            ) : null}
          </li>
        ))}
        {boarded.data?.length === 0 ? (
          <li className="py-oa-3 text-[15px] text-oa-ink-muted">Nobody has boarded yet.</li>
        ) : null}
      </ul>
    </Card>
  );
}
