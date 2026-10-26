import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import type {
  EventSummary,
  PickupPointSummary,
  RegisterRequest,
  RegisterResponse,
  ZoneSummary,
} from '@oa/types';
import {
  ApiError,
  Banner,
  Button,
  Card,
  Checkbox,
  DateStrip,
  Field,
  PageShell,
  Row,
  Select,
  Spinner,
  UpperRoomLogoSlot,
  clock,
  fullDate,
} from '@oa/ui';
import { api } from '../api';

interface PublicEvent {
  event: EventSummary;
  zones: ZoneSummary[];
  pickupPoints: PickupPointSummary[];
}

type Coming = 'CAMPUS' | 'AREA' | 'PRIVATE';

export function Register() {
  const { slug = '' } = useParams();
  const [coming, setComing] = useState<Coming>('CAMPUS');
  const [pickupPointId, setPickupPointId] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [consentData, setConsentData] = useState(false);
  const [consentEmail, setConsentEmail] = useState(true);
  const [touched, setTouched] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['event', slug],
    queryFn: () => api.get<PublicEvent>(`/events/${slug}/public`),
  });

  const points = useMemo(
    () => (data?.pickupPoints ?? []).filter((point) => point.kind === coming),
    [data, coming],
  );

  const register = useMutation({
    mutationFn: (body: RegisterRequest) =>
      api.post<RegisterResponse>(`/events/${data!.event.id}/registrations`, body),
  });

  if (isLoading) {
    return (
      <PageShell>
        <Spinner label="Loading" />
      </PageShell>
    );
  }

  if (error || !data) {
    return (
      <PageShell>
        <p className="oa-display text-[40px] leading-none">Not found</p>
        <p className="mt-oa-3">
          We cannot find that gathering. Please check the link on your flyer.
        </p>
      </PageShell>
    );
  }

  const { event } = data;
  const closed = event.status !== 'OPEN' && event.status !== 'LIVE';

  if (register.isSuccess) {
    return <Registered response={register.data} event={event} email={email} />;
  }

  const needsPoint = coming === 'CAMPUS' || coming === 'AREA';
  const nameError =
    touched && fullName.trim().length < 2 ? 'Please give your full name.' : undefined;
  const emailError =
    touched && !/.+@.+\..+/.test(email) ? 'Please check your email address.' : undefined;
  const pointError =
    touched && needsPoint && !pickupPointId
      ? 'Please choose where you are coming from.'
      : undefined;
  const consentError =
    touched && !consentData ? 'We need your permission to store your details.' : undefined;

  const submit = () => {
    setTouched(true);
    if (nameError || emailError || pointError || !consentData) return;
    register.mutate({
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim() || undefined,
      type: coming,
      pickupPointId: needsPoint ? pickupPointId : undefined,
      consentData,
      consentEmail,
    });
  };

  const failure = register.error instanceof ApiError ? register.error : null;

  return (
    <PageShell
      city={event.city}
      cityColor={event.cityColor}
      footer={
        <>
          One Accord by Upper Room. Entry is free.
          {event.privacyUrl ? (
            <>
              {' '}
              <a className="underline" href={event.privacyUrl}>
                Privacy notice
              </a>
              .
            </>
          ) : null}
        </>
      }
    >
      <UpperRoomLogoSlot className="mb-oa-3" />

      <h1 className="oa-display text-[clamp(40px,11vw,64px)] leading-[0.95]">
        Upper Room {event.city}
      </h1>
      <DateStrip iso={event.startsAt} timezone={event.timezone} />
      <p className="mb-oa-4 text-[16px]">
        {event.venue}
        {event.address ? `, ${event.address}` : ''}. Doors open before{' '}
        {clock(event.startsAt, event.timezone)}.
      </p>

      {closed ? (
        <Banner tone="warn">Registration for this gathering is closed.</Banner>
      ) : (
        <>
          {failure ? (
            <Banner tone="error">
              {failure.code === 'PICKUP_FULL'
                ? 'Every trip from that pickup point is full. Please choose another one below.'
                : failure.message}
            </Banner>
          ) : null}

          <fieldset className="mb-oa-3 border-0 p-0">
            <legend className="oa-label mb-oa-2">How are you coming?</legend>
            <div className="grid gap-oa-2">
              {(
                [
                  ['CAMPUS', 'By bus from my campus'],
                  ['AREA', 'By bus from my area'],
                  ['PRIVATE', 'On my own'],
                ] as Array<[Coming, string]>
              ).map(([value, label]) => (
                <label
                  key={value}
                  className={`flex min-h-[56px] cursor-pointer items-center gap-oa-3 rounded-oa-md border-2 px-oa-3 ${
                    coming === value ? 'border-oa-fire bg-oa-surface-muted' : 'border-oa-border'
                  }`}
                >
                  <input
                    type="radio"
                    name="coming"
                    value={value}
                    checked={coming === value}
                    onChange={() => {
                      setComing(value);
                      setPickupPointId('');
                    }}
                    className="h-6 w-6 min-h-0 accent-[color:var(--oa-fire)]"
                  />
                  <span className="text-[16px] font-semibold">{label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {needsPoint ? (
            <Select
              label={coming === 'CAMPUS' ? 'Your campus' : 'Your pickup point'}
              value={pickupPointId}
              error={pointError}
              onChange={(e) => setPickupPointId(e.target.value)}
            >
              <option value="">Choose one</option>
              {points.map((point) => (
                <option key={point.id} value={point.id} disabled={!point.hasSeats}>
                  {point.name}
                  {point.hasSeats
                    ? ` — leaves ${clock(point.departsAt, event.timezone)}`
                    : ' — full'}
                </option>
              ))}
            </Select>
          ) : null}

          <Field
            label="Full name"
            value={fullName}
            error={nameError}
            autoComplete="name"
            onChange={(e) => setFullName(e.target.value)}
          />
          <Field
            label="Email"
            type="email"
            inputMode="email"
            value={email}
            error={emailError}
            autoComplete="email"
            hint="Your UR Pass comes here."
            onChange={(e) => setEmail(e.target.value)}
          />
          <Field
            label="Phone (optional)"
            type="tel"
            inputMode="tel"
            value={phone}
            autoComplete="tel"
            onChange={(e) => setPhone(e.target.value)}
          />

          <Checkbox
            checked={consentData}
            onChange={(e) => setConsentData(e.target.checked)}
            label={
              <>
                I agree that One Accord may store my details for this gathering.
                {event.privacyUrl ? (
                  <>
                    {' '}
                    <a className="underline" href={event.privacyUrl}>
                      Privacy notice
                    </a>
                    .
                  </>
                ) : null}
              </>
            }
          />
          {consentError ? (
            <p className="mb-oa-2 text-[13px] font-semibold text-oa-fire-ink">{consentError}</p>
          ) : null}
          <Checkbox
            checked={consentEmail}
            onChange={(e) => setConsentEmail(e.target.checked)}
            label="Send me reminders about my trip."
          />

          <Button onClick={submit} loading={register.isPending}>
            Register
          </Button>
        </>
      )}
    </PageShell>
  );
}

/** PS-1: what the attendee sees while the pass is on its way. */
function Registered({
  response,
  event,
  email,
}: {
  response: RegisterResponse;
  event: EventSummary;
  email: string;
}) {
  return (
    <PageShell city={event.city} cityColor={event.cityColor}>
      <h1 className="oa-display text-[clamp(40px,11vw,64px)] leading-[0.95]">
        {response.resent ? "You're already registered" : "You're registered"}
      </h1>
      <p className="mb-oa-3 text-[16px]">
        Your UR Pass is on its way to <strong>{email}</strong>. Open it on the phone you will bring,
        so we recognise you at check-in.
      </p>

      <Card className="mb-oa-3">
        <Row
          label="Pass code"
          value={<span className="tracking-[0.12em]">{response.passCode}</span>}
        />
        <Row label="When" value={fullDate(event.startsAt, event.timezone)} />
        <Row label="Venue" value={event.venue} />
        {response.trip ? <Row label="Trip" value={response.trip.code} /> : null}
        {response.pickupPointName ? <Row label="Pickup" value={response.pickupPointName} /> : null}
        {response.trip ? (
          <Row label="Departs" value={clock(response.trip.departsAt, event.timezone)} />
        ) : null}
        {response.trip?.delegateFirstName ? (
          <Row label="Your delegate" value={response.trip.delegateFirstName} />
        ) : null}
      </Card>

      <p className="mb-oa-4 text-[15px] text-oa-ink-muted">
        {response.trip
          ? 'On the bus, your delegate will show a code. Scan it with your phone camera to check in, then collect your zone tag.'
          : "When you arrive, scan the “I've arrived” poster in the security queue."}
      </p>

      <Button onClick={() => window.location.assign(`/pass/${response.passCode}`)}>
        Open your UR Pass
      </Button>
    </PageShell>
  );
}
