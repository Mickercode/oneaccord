import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Banner, PageShell, Spinner } from '@oa/ui';
import { api } from '../api';

/** MS-2 */
export function Unsubscribe() {
  const { id = '', token = '' } = useParams();

  const unsubscribe = useMutation({
    mutationFn: () =>
      api.post<{ unsubscribed: boolean }>(`/registrations/${id}/unsubscribe/${token}`),
  });

  useEffect(() => {
    unsubscribe.mutate();
    // Once, on open: the link in the email is the whole instruction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PageShell>
      <h1 className="oa-display text-[40px] leading-none">Updates</h1>
      {unsubscribe.isPending ? <Spinner label="One moment" /> : null}
      {unsubscribe.isSuccess ? (
        <Banner>
          Done. We will not send you updates about this gathering again. You will still get anything
          essential about a trip you are booked on.
        </Banner>
      ) : null}
      {unsubscribe.isError ? (
        <Banner tone="error">
          That link is not valid. Please use the one in your latest email.
        </Banner>
      ) : null}
    </PageShell>
  );
}
