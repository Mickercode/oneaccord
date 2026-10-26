import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import type { CheckInResult } from '@oa/types';
import {
  ApiError,
  Banner,
  Button,
  Checkbox,
  Field,
  PageShell,
  StatusScreen,
  ZoneTag,
} from '@oa/ui';
import { api } from '../api';

/** GT-4: never registered, standing at the walk-in lane with their own phone. */
export function WalkIn() {
  const { token = '' } = useParams();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [consentData, setConsentData] = useState(false);
  const [consentEmail, setConsentEmail] = useState(true);
  const [touched, setTouched] = useState(false);

  const walkIn = useMutation({
    mutationFn: () =>
      api.post<CheckInResult>('/checkins/walk-in', {
        token,
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        consentData,
        consentEmail,
      }),
  });

  if (walkIn.isSuccess) {
    const result = walkIn.data;
    return (
      <StatusScreen
        tone="go"
        headline="Welcome"
        detail={
          <>
            <p className="mb-oa-3 text-[20px] font-semibold">{result.fullName}</p>
            {result.zone ? <p>Go to Zone {result.zone.letter}.</p> : null}
            <p className="mt-oa-2 text-[15px] opacity-90">
              Pass {result.passCode}. We have emailed it to you.
            </p>
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
      </StatusScreen>
    );
  }

  const nameError =
    touched && fullName.trim().length < 2 ? 'Please give your full name.' : undefined;
  const emailError =
    touched && !/.+@.+\..+/.test(email) ? 'Please check your email address.' : undefined;
  const failure = walkIn.error instanceof ApiError ? walkIn.error : null;

  return (
    <PageShell>
      <h1 className="oa-display text-[clamp(36px,10vw,56px)] leading-[0.95]">Welcome in</h1>
      <p className="mb-oa-4 text-[16px]">
        Two details and you are checked in. Your UR Pass follows by email.
      </p>

      {failure ? <Banner tone="error">{failure.message}</Banner> : null}

      <Field
        label="Full name"
        value={fullName}
        error={nameError}
        autoComplete="name"
        onChange={(event) => setFullName(event.target.value)}
      />
      <Field
        label="Email"
        type="email"
        inputMode="email"
        value={email}
        error={emailError}
        autoComplete="email"
        onChange={(event) => setEmail(event.target.value)}
      />
      <Field
        label="Phone (optional)"
        type="tel"
        inputMode="tel"
        value={phone}
        autoComplete="tel"
        onChange={(event) => setPhone(event.target.value)}
      />

      <Checkbox
        checked={consentData}
        onChange={(event) => setConsentData(event.target.checked)}
        label="I agree that One Accord may store my details for this gathering."
      />
      <Checkbox
        checked={consentEmail}
        onChange={(event) => setConsentEmail(event.target.checked)}
        label="Tell me about the next Upper Room."
      />

      <Button
        loading={walkIn.isPending}
        onClick={() => {
          setTouched(true);
          if (nameError || emailError || !consentData) return;
          walkIn.mutate();
        }}
      >
        Check in
      </Button>
    </PageShell>
  );
}
