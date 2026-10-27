import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { PassView } from '@oa/types';
import {
  Banner,
  Button,
  Card,
  Field,
  DateStrip,
  PageShell,
  Row,
  Spinner,
  UpperRoomLogoSlot,
  ZoneTag,
  clock,
  fullDate,
} from '@oa/ui';
import { api, passSession } from '../api';

/**
 * PS-2: the pass page. Loading it stamps this phone as the attendee's, which
 * is what makes boarding a single tap later.
 */
export function Pass() {
  const { code = '' } = useParams();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['pass', code],
    queryFn: () => api.get<PassView>(`/passes/${code}/view`),
    retry: false,
  });

  // PS-2: opening the pass is what makes this phone recognise the attendee at
  // check-in. The API sets a cookie too; this covers the case where the API is
  // on another site and the browser withholds it.
  useEffect(() => {
    if (data?.deviceToken) passSession.set(data.deviceToken);
  }, [data?.deviceToken]);

  if (isLoading) {
    return (
      <PageShell>
        <Spinner label="Loading your pass" />
      </PageShell>
    );
  }

  if (isError || !data) {
    return (
      <PageShell>
        <h1 className="oa-display text-[40px] leading-none">We cannot find this pass</h1>
        <p className="mt-oa-3">
          Please check the link in your email, or head to the walk-in lane on the day.
        </p>
      </PageShell>
    );
  }

  const { event, trip, zone } = data;

  return (
    <PageShell
      city={event.city}
      cityColor={event.cityColor}
      footer="Have your UR Pass ready. Entry is free."
    >
      <UpperRoomLogoSlot className="mb-oa-3" />

      <p className="oa-label">Your UR Pass</p>
      <h1 className="oa-display mb-oa-2 text-[clamp(40px,11vw,64px)] leading-[0.95]">
        {data.fullName}
      </h1>

      <p
        className="oa-wide mb-oa-3 rounded-oa-md bg-oa-surface-muted px-oa-3 py-oa-3 text-center text-[32px] tracking-[0.18em]"
        aria-label={`Pass code ${data.passCode.split('').join(' ')}`}
      >
        {data.passCode}
      </p>

      <DateStrip iso={event.startsAt} timezone={event.timezone} />

      {data.checkedIn.arrived ? (
        <Banner>You are checked in and inside. Welcome.</Banner>
      ) : data.checkedIn.boarded ? (
        <Banner>You are checked in and on your way.</Banner>
      ) : null}

      <Card className="mb-oa-3">
        <Row label="Venue" value={event.venue} />
        <Row label="When" value={fullDate(event.startsAt, event.timezone)} />
        {trip ? <Row label="Trip" value={trip.code} /> : null}
        {data.pickupPoint ? (
          <Row
            label="Pickup"
            value={
              <>
                {data.pickupPoint.name}
                <br />
                <span className="text-[13px] font-normal text-oa-ink-muted">
                  {data.pickupPoint.address}
                </span>
              </>
            }
          />
        ) : null}
        {trip ? <Row label="Departs" value={clock(trip.departsAt, event.timezone)} /> : null}
        {data.delegateFirstName ? (
          <Row label="Your delegate" value={data.delegateFirstName} />
        ) : null}
      </Card>

      {zone ? (
        <Card className="mb-oa-3">
          <p className="oa-label mb-oa-2">Your zone</p>
          <ZoneTag letter={zone.letter} name={zone.name} color={zone.color} size="lg" />
        </Card>
      ) : (
        <p className="mb-oa-3 text-[15px] text-oa-ink-muted">
          Your zone is given to you when you check in.
        </p>
      )}

      <p className="mb-oa-3 text-[15px]">
        {trip
          ? 'On the bus, scan the code your delegate shows. One tap checks you in and gives you your zone tag.'
          : "When you arrive, scan the “I've arrived” poster in the security queue."}
      </p>

      {data.whatsappUrl ? (
        <p className="mb-oa-4 text-[15px]">
          Your trip has a WhatsApp group, run by your delegate:{' '}
          <a className="underline" href={data.whatsappUrl}>
            join it here
          </a>
          .
        </p>
      ) : null}

      <ForgetMe passCode={data.passCode} />
    </PageShell>
  );
}

/**
 * The Nigeria Data Protection Act 2023 gives every attendee the right to have
 * their details removed, so the way to ask sits on the pass itself.
 */
function ForgetMe({ passCode }: { passCode: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');

  const forget = useMutation({
    mutationFn: () => api.post<{ removed: boolean }>(`/passes/${passCode}/forget`, { email }),
  });

  if (forget.isSuccess) {
    return (
      <Banner>
        Your details have been removed. Your UR Pass no longer works, and we will not email you
        again about this gathering.
      </Banner>
    );
  }

  return (
    <details
      className="border-t border-oa-border pt-oa-3"
      open={open}
      onToggle={(event) => setOpen((event.target as HTMLDetailsElement).open)}
    >
      <summary className="oa-label cursor-pointer">Remove my details</summary>
      <p className="mb-oa-3 mt-oa-2 text-[15px]">
        We will remove your name, email and phone number. Confirm the email address your pass was
        sent to.
      </p>
      {forget.isError ? (
        <Banner tone="error">
          We cannot find a pass with that code and email address. Please check the email your pass
          came to.
        </Banner>
      ) : null}
      <Field
        label="Your email"
        type="email"
        inputMode="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <Button
        variant="danger"
        loading={forget.isPending}
        disabled={!/.+@.+\..+/.test(email)}
        onClick={() => forget.mutate()}
      >
        Remove my details
      </Button>
    </details>
  );
}
