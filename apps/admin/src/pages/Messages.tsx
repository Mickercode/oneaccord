import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  EventSummary,
  MessageRequest,
  PickupPointSummary,
  TeamSession,
  TripSummary,
} from '@oa/types';
import { ApiError, Banner, Button, Card, Checkbox, Field, Select, Spinner } from '@oa/ui';
import { api } from '../api';
import { AdminShell } from '../shell';

interface SentMessage {
  id: string;
  subject: string;
  body: string;
  audience: string;
  sentCount: number;
  createdAt: string;
  createdBy: { fullName: string } | null;
}

/** MS-1 and MS-2 */
export function Messages({ session }: { session: TeamSession }) {
  const { eventId = '' } = useParams();
  const queryClient = useQueryClient();

  const [audience, setAudience] = useState<MessageRequest['audience']>('EVENT');
  const [audienceId, setAudienceId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [essential, setEssential] = useState(false);

  const event = useQuery({
    queryKey: ['event', eventId],
    queryFn: () =>
      api.get<{ event: EventSummary; pickupPoints: PickupPointSummary[] }>(
        `/events/${eventId}/public`,
      ),
  });

  const trips = useQuery({
    queryKey: ['trips', eventId],
    queryFn: () => api.get<TripSummary[]>(`/events/${eventId}/trips`),
  });

  const sent = useQuery({
    queryKey: ['messages', eventId],
    queryFn: () => api.get<SentMessage[]>(`/events/${eventId}/messages`),
  });

  const send = useMutation({
    mutationFn: () =>
      api.post<{ sentCount: number }>(`/events/${eventId}/messages`, {
        audience,
        audienceId: audience === 'EVENT' ? undefined : audienceId,
        subject,
        body,
        essential,
      }),
    onSuccess: () => {
      setSubject('');
      setBody('');
      void queryClient.invalidateQueries({ queryKey: ['messages', eventId] });
    },
  });

  const failure = send.error instanceof ApiError ? send.error : null;

  return (
    <AdminShell session={session} title="Messages" event={event.data?.event}>
      <div className="grid gap-oa-3 md:grid-cols-2">
        <Card>
          <h2 className="oa-label mb-oa-2">Write to attendees</h2>
          {failure ? <Banner tone="error">{failure.message}</Banner> : null}
          {send.isSuccess ? <Banner>Queued to {send.data.sentCount} people.</Banner> : null}

          <Select
            label="Who"
            value={audience}
            onChange={(e) => {
              setAudience(e.target.value as MessageRequest['audience']);
              setAudienceId('');
            }}
          >
            <option value="EVENT">Everyone at this gathering</option>
            <option value="PICKUP_POINT">One pickup point</option>
            <option value="TRIP">One trip</option>
          </Select>

          {audience === 'PICKUP_POINT' ? (
            <Select
              label="Pickup point"
              value={audienceId}
              onChange={(e) => setAudienceId(e.target.value)}
            >
              <option value="">Choose one</option>
              {(event.data?.pickupPoints ?? []).map((point) => (
                <option key={point.id} value={point.id}>
                  {point.name}
                </option>
              ))}
            </Select>
          ) : null}

          {audience === 'TRIP' ? (
            <Select label="Trip" value={audienceId} onChange={(e) => setAudienceId(e.target.value)}>
              <option value="">Choose one</option>
              {(trips.data ?? []).map((trip) => (
                <option key={trip.id} value={trip.id}>
                  Trip {trip.code} — {trip.pickupPointName}
                </option>
              ))}
            </Select>
          ) : null}

          <Field
            label="Subject"
            value={subject}
            placeholder="Your trip now leaves at 2:30 pm"
            onChange={(e) => setSubject(e.target.value)}
          />

          <label className="oa-label mb-oa-1 block" htmlFor="message-body">
            Message
          </label>
          <textarea
            id="message-body"
            value={body}
            rows={7}
            onChange={(e) => setBody(e.target.value)}
            className="mb-oa-3 w-full rounded-oa-md border-2 border-oa-border bg-oa-surface p-oa-2 text-[16px] text-oa-ink"
          />

          <Checkbox
            checked={essential}
            onChange={(e) => setEssential(e.target.checked)}
            label="Essential: send to everyone, including people who opted out of updates."
          />

          <Button
            loading={send.isPending}
            disabled={
              subject.trim().length < 3 ||
              body.trim().length < 3 ||
              (audience !== 'EVENT' && !audienceId)
            }
            onClick={() => send.mutate()}
          >
            Send
          </Button>
        </Card>

        <Card>
          <h2 className="oa-label mb-oa-2">Already sent</h2>
          {sent.isLoading ? <Spinner label="Loading" /> : null}
          <ul className="divide-y divide-oa-border">
            {(sent.data ?? []).map((message) => (
              <li key={message.id} className="py-oa-2">
                <div className="flex items-baseline justify-between gap-oa-2">
                  <span className="text-[16px] font-semibold">{message.subject}</span>
                  <span className="oa-label">{message.sentCount}</span>
                </div>
                <p className="text-[13px] text-oa-ink-muted">
                  {message.audience.toLowerCase().replace('_', ' ')} ·{' '}
                  {message.createdBy?.fullName ?? 'the team'}
                </p>
              </li>
            ))}
            {sent.data?.length === 0 ? (
              <li className="py-oa-2 text-[15px] text-oa-ink-muted">Nothing sent yet.</li>
            ) : null}
          </ul>
        </Card>
      </div>
    </AdminShell>
  );
}
