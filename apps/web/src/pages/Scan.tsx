import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { CheckInResult, ScanContext, ScanKind } from '@oa/types';
import {
  ApiError,
  Banner,
  Button,
  Card,
  DateStrip,
  Field,
  PageShell,
  Row,
  Spinner,
  StatusScreen,
  ZoneTag,
  clock,
} from '@oa/ui';
import { api } from '../api';

/**
 * BD-2 and GT-2. The attendee's own phone camera opens this page. Everything
 * here is built around one question and one tap.
 */
export function Scan({ kind }: { kind: ScanKind }) {
  const { token = '' } = useParams();
  const [passCode, setPassCode] = useState('');
  const [email, setEmail] = useState('');
  const [useEmail, setUseEmail] = useState(false);
  /** A borrowed phone: ignore the pass it carries and ask who this is. */
  const [asSomeoneElse, setAsSomeoneElse] = useState(false);

  const context = useQuery({
    queryKey: ['scan', token],
    queryFn: () => api.get<ScanContext>(`/checkins/context?token=${encodeURIComponent(token)}`),
    // The boarding code rotates every 30 seconds; this page is read once.
    staleTime: 0,
    retry: false,
  });

  const checkIn = useMutation({
    mutationFn: (body: { token: string; passCode?: string; email?: string }) =>
      api.post<CheckInResult>(kind === 'BOARDING' ? '/checkins/boarding' : '/checkins/gate', body),
  });

  if (context.isLoading) {
    return (
      <PageShell>
        <Spinner label="One moment" />
      </PageShell>
    );
  }

  if (context.isError || !context.data) {
    return (
      <StatusScreen
        tone="stop"
        headline="We cannot read that code"
        detail="Please ask your delegate to show it again, or head to the walk-in lane."
      />
    );
  }

  const scan = context.data;

  if (checkIn.isSuccess) {
    return <Done result={checkIn.data} kind={kind} timezone={scan.event.timezone} />;
  }

  if (!scan.valid) {
    return <Refused scan={scan} />;
  }

  const failure = checkIn.error instanceof ApiError ? checkIn.error : null;
  if (failure?.code === 'EXPIRED') {
    return (
      <StatusScreen
        tone="check"
        headline="That code has expired"
        detail="Codes change every 30 seconds. Ask your delegate to show it again."
      >
        <Button variant="quiet" onClick={() => checkIn.reset()}>
          Try again
        </Button>
      </StatusScreen>
    );
  }

  const title =
    kind === 'BOARDING'
      ? `Check in to Trip ${scan.trip?.code ?? ''}`
      : `Check in at ${scan.gateName ?? 'the gate'}`;

  return (
    <PageShell city={scan.event.city} cityColor={scan.event.cityColor}>
      <h1 className="oa-display text-[clamp(36px,10vw,56px)] leading-[0.95]">{title}</h1>
      <DateStrip iso={scan.event.startsAt} timezone={scan.event.timezone} />

      {failure ? <Banner tone="error">{failure.message}</Banner> : null}

      {scan.trip ? (
        <Card className="mb-oa-3">
          <Row label="Trip" value={scan.trip.code} />
          <Row label="Pickup" value={scan.trip.pickupPointName} />
          <Row label="Departs" value={clock(scan.trip.departsAt, scan.event.timezone)} />
          {scan.trip.delegateFirstName ? (
            <Row label="Your delegate" value={scan.trip.delegateFirstName} />
          ) : null}
        </Card>
      ) : null}

      {scan.attendee && !asSomeoneElse ? (
        <>
          <p className="mb-oa-3 text-[18px]">
            {kind === 'BOARDING' ? 'Check in as' : 'Arriving as'}{' '}
            <strong>{scan.attendee.fullName}</strong>?
          </p>
          {scan.trip && !scan.attendee.onThisTrip ? (
            <Banner tone="warn">
              You registered for another trip. Boarding here is fine — we will record the trip you
              actually took.
            </Banner>
          ) : null}
          <Button loading={checkIn.isPending} onClick={() => checkIn.mutate({ token })}>
            {kind === 'BOARDING' ? 'Check in' : "I've arrived"}
          </Button>
          <button
            type="button"
            className="mt-oa-3 w-full text-[15px] underline"
            onClick={() => {
              // A borrowed phone: ask for a pass code instead of its cookie.
              setUseEmail(false);
              setPassCode('');
              setAsSomeoneElse(true);
            }}
          >
            Not {scan.attendee.fullName.split(' ')[0]}?
          </button>
        </>
      ) : (
        <>
          <p className="mb-oa-3 text-[16px]">
            This phone is not carrying a UR Pass. Type your pass code from the email.
          </p>
          {useEmail ? (
            <Field
              label="Email"
              type="email"
              inputMode="email"
              value={email}
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
            />
          ) : (
            <Field
              label="Pass code"
              value={passCode}
              placeholder="UR-4K7Q"
              autoCapitalize="characters"
              autoComplete="off"
              hint="Four characters after UR-."
              onChange={(event) => setPassCode(event.target.value)}
            />
          )}

          <Button
            loading={checkIn.isPending}
            disabled={useEmail ? email.length < 5 : passCode.replace(/\W/g, '').length < 4}
            onClick={() =>
              checkIn.mutate(
                useEmail ? { token, email: email.trim() } : { token, passCode: passCode.trim() },
              )
            }
          >
            {kind === 'BOARDING' ? 'Check in' : "I've arrived"}
          </Button>

          <button
            type="button"
            className="mt-oa-3 w-full text-[15px] underline"
            onClick={() => setUseEmail((value) => !value)}
          >
            {useEmail ? 'Use my pass code instead' : 'Use my email instead'}
          </button>

          {kind === 'GATE' ? (
            <p className="mt-oa-4 text-[15px] text-oa-ink-muted">
              Never registered?{' '}
              <Link className="underline" to={`/walk-in/${token}`}>
                Register at the walk-in lane
              </Link>
              .
            </p>
          ) : null}
        </>
      )}
    </PageShell>
  );
}

/** BD-7: the one thing they must do next, in the largest type on the screen. */
function Done({
  result,
  kind,
  timezone,
}: {
  result: CheckInResult;
  kind: ScanKind;
  timezone: string;
}) {
  const headline = result.alreadyCheckedIn
    ? "You're already checked in"
    : kind === 'BOARDING'
      ? "You're checked in"
      : 'Welcome';

  return (
    <StatusScreen
      tone="go"
      headline={headline}
      detail={
        <>
          <p className="mb-oa-3 text-[20px] font-semibold">{result.fullName}</p>
          {kind === 'BOARDING' && result.trip ? (
            <p className="mb-oa-2">
              Trip {result.trip.code}
              {result.switchedTrip ? ' — the trip you actually took' : ''}. Welcome aboard.
            </p>
          ) : null}
          {result.zone ? (
            <p className="text-[18px]">
              {kind === 'BOARDING' && result.delegateFirstName
                ? `Collect your Zone ${result.zone.letter} tag from ${result.delegateFirstName}.`
                : `Go to Zone ${result.zone.letter}${result.zone.name ? `, ${result.zone.name}` : ''}.`}
            </p>
          ) : null}
        </>
      }
    >
      {result.zone ? (
        <div className="rounded-oa-lg bg-white/15 p-oa-3">
          <ZoneTag
            letter={result.zone.letter}
            name={result.zone.name}
            color={result.zone.color}
            size="lg"
          />
        </div>
      ) : null}
      <p className="mt-oa-3 text-[15px] opacity-90">Pass {result.passCode}</p>
      {result.trip ? (
        <p className="text-[15px] opacity-90">Departs {clock(result.trip.departsAt, timezone)}</p>
      ) : null}
    </StatusScreen>
  );
}

function Refused({ scan }: { scan: ScanContext }) {
  if (scan.reason === 'EXPIRED') {
    return (
      <StatusScreen
        tone="check"
        headline="That code has expired"
        detail="Codes change every 30 seconds. Ask your delegate to show it again."
      />
    );
  }
  if (scan.reason === 'TRIP_LOCKED') {
    return (
      <StatusScreen
        tone="check"
        headline="This trip has left"
        detail="Please speak to your delegate."
      />
    );
  }
  if (scan.reason === 'OUTSIDE_HOURS') {
    return (
      <StatusScreen
        tone="check"
        headline="The doors are not open yet"
        detail="Please try again when the doors open."
      />
    );
  }
  return (
    <StatusScreen
      tone="stop"
      headline="We cannot read that code"
      detail="Please ask a steward for help."
    />
  );
}
