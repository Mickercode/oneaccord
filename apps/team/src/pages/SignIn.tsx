import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Banner, Button, Field } from '@oa/ui';
import { api } from '../api';

/** EV-5: no passwords. A link to the address the team was invited on. */
export function SignIn() {
  const [email, setEmail] = useState('');
  const [params] = useSearchParams();
  const expired = params.get('error') === 'expired';

  const send = useMutation({
    mutationFn: () => api.post('/auth/magic-link', { email: email.trim().toLowerCase() }),
  });

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[440px] flex-col justify-center px-oa-3 py-oa-4">
      <p className="oa-label">One Accord</p>
      <h1 className="oa-display mb-oa-3 text-[40px] leading-none">Sign in</h1>

      {expired ? (
        <Banner tone="warn">That link has been used or has expired. Here is a new one.</Banner>
      ) : null}

      {send.isSuccess ? (
        <Banner>
          If that address is on the team, a sign-in link is on its way. It works once and lasts 20
          minutes.
        </Banner>
      ) : (
        <>
          <p className="mb-oa-3 text-[16px] text-oa-ink-muted">
            We send a link to your email. No password to remember on a bus.
          </p>
          <Field
            label="Your email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Button
            loading={send.isPending}
            disabled={!/.+@.+\..+/.test(email)}
            onClick={() => send.mutate()}
          >
            Send my link
          </Button>
        </>
      )}
    </div>
  );
}
