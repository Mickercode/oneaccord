import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EventSummary, TeamSession } from '@oa/types';
import { ApiError, Banner, Button, Card, Field, Spinner, fullDate } from '@oa/ui';
import { api } from '../api';
import { AdminShell } from '../shell';

/** EV-1: the list of cities, and how a new one starts. */
export function Events({ session }: { session: TeamSession }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);

  const events = useQuery({
    queryKey: ['events'],
    queryFn: () => api.get<EventSummary[]>('/events'),
  });

  return (
    <AdminShell
      session={session}
      title="Gatherings"
      right={
        <Button
          full={false}
          variant={adding ? 'quiet' : 'primary'}
          onClick={() => setAdding((v) => !v)}
        >
          {adding ? 'Cancel' : 'New gathering'}
        </Button>
      }
    >
      {adding ? (
        <NewEvent
          onCreated={(event) => {
            setAdding(false);
            void queryClient.invalidateQueries({ queryKey: ['events'] });
            navigate(`/events/${event.id}/setup`);
          }}
        />
      ) : null}

      {events.isLoading ? <Spinner label="Loading" /> : null}

      <div className="grid gap-oa-2 md:grid-cols-2">
        {(events.data ?? []).map((event) => (
          <Card key={event.id}>
            <div className="mb-oa-2 flex items-center justify-between gap-oa-2">
              <span className="oa-display text-[28px] leading-none">{event.city}</span>
              <span className="oa-label">{event.status.toLowerCase()}</span>
            </div>
            <p className="mb-oa-3 text-[15px] text-oa-ink-muted">
              {event.venue} · {fullDate(event.startsAt, event.timezone)}
            </p>
            <div className="grid grid-cols-2 gap-oa-2">
              <Button onClick={() => navigate(`/events/${event.id}`)}>Live</Button>
              <Button variant="quiet" onClick={() => navigate(`/events/${event.id}/setup`)}>
                Setup
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {events.data?.length === 0 && !adding ? (
        <p className="text-[15px] text-oa-ink-muted">No gatherings yet. Start with a new one.</p>
      ) : null}
    </AdminShell>
  );
}

function NewEvent({ onCreated }: { onCreated: (event: EventSummary) => void }) {
  const [city, setCity] = useState('');
  const [venue, setVenue] = useState('');
  const [slug, setSlug] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('17:00');
  const [cityColor, setCityColor] = useState('#F5C400');

  const create = useMutation({
    mutationFn: () => {
      // Doors open three hours before and close four hours after.
      const startsAt = new Date(`${date}T${time}:00`);
      return api.post<EventSummary>('/events', {
        slug: slug || city.toLowerCase().replace(/\W+/g, '-'),
        city,
        venue,
        startsAt: startsAt.toISOString(),
        doorsOpenAt: new Date(startsAt.getTime() - 3 * 3_600_000).toISOString(),
        doorsCloseAt: new Date(startsAt.getTime() + 4 * 3_600_000).toISOString(),
        cityColor,
      });
    },
    onSuccess: onCreated,
  });

  const failure = create.error instanceof ApiError ? create.error : null;

  return (
    <Card className="mb-oa-4">
      <h2 className="oa-display mb-oa-3 text-[28px] leading-none">New gathering</h2>
      {failure ? <Banner tone="error">{failure.message}</Banner> : null}
      <div className="grid gap-oa-2 md:grid-cols-2">
        <Field label="City" value={city} onChange={(e) => setCity(e.target.value)} />
        <Field label="Venue" value={venue} onChange={(e) => setVenue(e.target.value)} />
        <Field
          label="Link name"
          value={slug}
          placeholder={city ? city.toLowerCase().replace(/\W+/g, '-') : 'lagos-2026'}
          hint="Used in the registration link."
          onChange={(e) => setSlug(e.target.value)}
        />
        <Field
          label="City colour"
          type="color"
          value={cityColor}
          onChange={(e) => setCityColor(e.target.value)}
        />
        <Field label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Field
          label="Start time"
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />
      </div>
      <Button
        loading={create.isPending}
        disabled={!city || !venue || !date}
        onClick={() => create.mutate()}
      >
        Create and set it up
      </Button>
    </Card>
  );
}
