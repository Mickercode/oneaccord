import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import type {
  EventSummary,
  PickupPointSummary,
  TeamSession,
  TripSummary,
  ZoneSummary,
} from '@oa/types';
import { ApiError, Banner, Button, Card, Field, Select, Spinner, clock } from '@oa/ui';
import { api } from '../api';
import { AdminShell } from '../shell';

interface Bus {
  id: string;
  code: string;
  capacity: number;
}

interface GateRow {
  id: string;
  name: string;
  posterUrl: string;
}

interface TeamRow {
  id: string;
  email: string;
  fullName: string;
  role: string;
  pickupPointName: string | null;
  gateId: string | null;
}

type Tab = 'zones' | 'points' | 'buses' | 'gates' | 'team' | 'import';

/** EV-2 to EV-7, in the order a city is actually set up. */
export function Setup({ session }: { session: TeamSession }) {
  const { eventId = '' } = useParams();
  const [tab, setTab] = useState<Tab>('zones');

  const event = useQuery({
    queryKey: ['event', eventId],
    queryFn: () =>
      api.get<{ event: EventSummary; zones: ZoneSummary[]; pickupPoints: PickupPointSummary[] }>(
        `/events/${eventId}/public`,
      ),
  });

  if (event.isLoading || !event.data) {
    return (
      <AdminShell session={session} title="Setup">
        <Spinner label="Loading" />
      </AdminShell>
    );
  }

  return (
    <AdminShell session={session} title="Setup" event={event.data.event}>
      <nav className="mb-oa-3 flex flex-wrap gap-oa-2">
        {(
          [
            ['zones', 'Zones'],
            ['points', 'Pickup points'],
            ['buses', 'Buses and trips'],
            ['gates', 'Gates and posters'],
            ['team', 'Delegates and ushers'],
            ['import', 'Import and copy'],
          ] as Array<[Tab, string]>
        ).map(([value, label]) => (
          <Button
            key={value}
            full={false}
            variant={tab === value ? 'primary' : 'quiet'}
            onClick={() => setTab(value)}
          >
            {label}
          </Button>
        ))}
      </nav>

      {tab === 'zones' ? <Zones eventId={eventId} zones={event.data.zones} /> : null}
      {tab === 'points' ? (
        <Points
          eventId={eventId}
          zones={event.data.zones}
          points={event.data.pickupPoints}
          timezone={event.data.event.timezone}
        />
      ) : null}
      {tab === 'buses' ? (
        <Buses
          eventId={eventId}
          points={event.data.pickupPoints}
          timezone={event.data.event.timezone}
        />
      ) : null}
      {tab === 'gates' ? <Gates eventId={eventId} /> : null}
      {tab === 'team' ? <Team eventId={eventId} points={event.data.pickupPoints} /> : null}
      {tab === 'import' ? <ImportAndCopy eventId={eventId} event={event.data.event} /> : null}
    </AdminShell>
  );
}

function useRefresh(eventId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['event', eventId] });
}

/** EV-4 */
function Zones({ eventId, zones }: { eventId: string; zones: ZoneSummary[] }) {
  const refresh = useRefresh(eventId);
  const [letter, setLetter] = useState('');
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('1000');
  const [color, setColor] = useState('#E52A2A');

  const add = useMutation({
    mutationFn: () =>
      api.post(`/events/${eventId}/zones`, {
        letter: letter.toUpperCase(),
        name,
        color,
        capacity: Number(capacity),
      }),
    onSuccess: () => {
      setLetter('');
      setName('');
      void refresh();
    },
  });

  return (
    <div className="grid gap-oa-3 md:grid-cols-2">
      <Card>
        <h2 className="oa-label mb-oa-2">Zones in the hall</h2>
        <ul className="divide-y divide-oa-border">
          {zones.map((zone) => (
            <li key={zone.id} className="flex items-center gap-oa-3 py-oa-2">
              <span
                className="oa-display flex h-10 w-10 items-center justify-center rounded-oa-md text-[24px] text-oa-on-gold"
                style={{ background: zone.color }}
              >
                {zone.letter}
              </span>
              <span className="flex-1">
                <span className="block text-[16px] font-semibold">{zone.name}</span>
                <span className="block text-[13px] text-oa-ink-muted">
                  {zone.capacity.toLocaleString('en-NG')} seats
                </span>
              </span>
            </li>
          ))}
          {zones.length === 0 ? (
            <li className="py-oa-2 text-[15px] text-oa-ink-muted">No zones yet.</li>
          ) : null}
        </ul>
      </Card>

      <Card>
        <h2 className="oa-label mb-oa-2">Add a zone</h2>
        <Field
          label="Letter"
          value={letter}
          maxLength={2}
          onChange={(e) => setLetter(e.target.value)}
        />
        <Field
          label="Name"
          value={name}
          placeholder="Middle, centre"
          onChange={(e) => setName(e.target.value)}
        />
        <Field
          label="Seats"
          type="number"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
        />
        <Field
          label="Colour"
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
        />
        <Button loading={add.isPending} disabled={!letter || !name} onClick={() => add.mutate()}>
          Add zone
        </Button>
      </Card>
    </div>
  );
}

/** EV-2 */
function Points({
  eventId,
  zones,
  points,
  timezone,
}: {
  eventId: string;
  zones: ZoneSummary[];
  points: PickupPointSummary[];
  timezone: string;
}) {
  const refresh = useRefresh(eventId);
  const [kind, setKind] = useState<'CAMPUS' | 'AREA'>('CAMPUS');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [departsAt, setDepartsAt] = useState('');
  const [zoneId, setZoneId] = useState('');

  const add = useMutation({
    mutationFn: () =>
      api.post(`/events/${eventId}/pickup-points`, {
        kind,
        name,
        address,
        departsAt: new Date(departsAt).toISOString(),
        zoneId: zoneId || undefined,
      }),
    onSuccess: () => {
      setName('');
      setAddress('');
      void refresh();
    },
  });

  const failure = add.error instanceof ApiError ? add.error : null;

  return (
    <div className="grid gap-oa-3 md:grid-cols-2">
      <Card>
        <h2 className="oa-label mb-oa-2">Pickup points</h2>
        <ul className="divide-y divide-oa-border">
          {points.map((point) => (
            <li key={point.id} className="py-oa-2">
              <div className="flex items-baseline justify-between gap-oa-2">
                <span className="text-[16px] font-semibold">{point.name}</span>
                <span className="oa-label">{point.kind.toLowerCase()}</span>
              </div>
              <p className="text-[13px] text-oa-ink-muted">
                {point.address} · leaves {clock(point.departsAt, timezone)}
                {point.zone ? ` · Zone ${point.zone.letter}` : ' · no zone'}
              </p>
              <p className="text-[13px]">
                {point.seatsLeft > 0 ? `${point.seatsLeft} seats left` : 'Full'}
              </p>
            </li>
          ))}
          {points.length === 0 ? (
            <li className="py-oa-2 text-[15px] text-oa-ink-muted">No pickup points yet.</li>
          ) : null}
        </ul>
      </Card>

      <Card>
        <h2 className="oa-label mb-oa-2">Add a pickup point</h2>
        {failure ? <Banner tone="error">{failure.message}</Banner> : null}
        <Select
          label="Kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as 'CAMPUS' | 'AREA')}
        >
          <option value="CAMPUS">Campus</option>
          <option value="AREA">Area</option>
        </Select>
        <Field
          label="Name"
          value={name}
          placeholder="UNILAG main gate"
          onChange={(e) => setName(e.target.value)}
        />
        <Field label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
        <Field
          label="First departure"
          type="datetime-local"
          value={departsAt}
          onChange={(e) => setDepartsAt(e.target.value)}
        />
        <Select
          label="Zone"
          value={zoneId}
          onChange={(e) => setZoneId(e.target.value)}
          hint="A whole bus sits together."
        >
          <option value="">No zone yet</option>
          {zones.map((zone) => (
            <option key={zone.id} value={zone.id}>
              Zone {zone.letter} — {zone.name}
            </option>
          ))}
        </Select>
        <Button
          loading={add.isPending}
          disabled={!name || !address || !departsAt}
          onClick={() => add.mutate()}
        >
          Add pickup point
        </Button>
      </Card>
    </div>
  );
}

/** EV-3 */
function Buses({
  eventId,
  points,
  timezone,
}: {
  eventId: string;
  points: PickupPointSummary[];
  timezone: string;
}) {
  const queryClient = useQueryClient();
  const [busCode, setBusCode] = useState('');
  const [busCapacity, setBusCapacity] = useState('60');
  const [tripCode, setTripCode] = useState('');
  const [busId, setBusId] = useState('');
  const [pickupPointId, setPickupPointId] = useState('');
  const [departsAt, setDepartsAt] = useState('');

  const buses = useQuery({
    queryKey: ['buses', eventId],
    // The public view does not carry buses, so read them from the trips list.
    queryFn: () => api.get<Bus[]>(`/events/${eventId}/buses`).catch(() => [] as Bus[]),
  });

  const trips = useQuery({
    queryKey: ['trips', eventId],
    queryFn: () => api.get<TripSummary[]>(`/events/${eventId}/trips`),
  });

  const addBus = useMutation({
    mutationFn: () =>
      api.post<Bus>(`/events/${eventId}/buses`, { code: busCode, capacity: Number(busCapacity) }),
    onSuccess: (bus) => {
      setBusCode('');
      setBusId(bus.id);
      void queryClient.invalidateQueries({ queryKey: ['buses', eventId] });
    },
  });

  const addTrip = useMutation({
    mutationFn: () =>
      api.post(`/events/${eventId}/trips`, {
        code: tripCode,
        busId,
        pickupPointId,
        capacity: Number(busCapacity),
        departsAt: new Date(departsAt).toISOString(),
      }),
    onSuccess: () => {
      setTripCode('');
      void queryClient.invalidateQueries({ queryKey: ['trips', eventId] });
    },
  });

  const failure =
    addTrip.error instanceof ApiError
      ? addTrip.error
      : addBus.error instanceof ApiError
        ? addBus.error
        : null;

  return (
    <div className="grid gap-oa-3 md:grid-cols-2">
      <Card>
        <h2 className="oa-label mb-oa-2">Trips</h2>
        <ul className="divide-y divide-oa-border">
          {(trips.data ?? []).map((trip) => (
            <li key={trip.id} className="flex items-baseline justify-between gap-oa-2 py-oa-2">
              <span>
                <span className="block text-[16px] font-semibold">Trip {trip.code}</span>
                <span className="block text-[13px] text-oa-ink-muted">
                  {trip.pickupPointName} · {clock(trip.departsAt, timezone)} ·{' '}
                  {trip.delegateFirstName ?? 'no delegate'}
                </span>
              </span>
              <span className="text-[15px]">{trip.capacity} seats</span>
            </li>
          ))}
          {trips.data?.length === 0 ? (
            <li className="py-oa-2 text-[15px] text-oa-ink-muted">No trips yet.</li>
          ) : null}
        </ul>
      </Card>

      <div className="grid gap-oa-3">
        <Card>
          <h2 className="oa-label mb-oa-2">Add a bus</h2>
          {failure ? <Banner tone="error">{failure.message}</Banner> : null}
          <Field
            label="Bus number"
            value={busCode}
            placeholder="12"
            onChange={(e) => setBusCode(e.target.value)}
          />
          <Field
            label="Seats"
            type="number"
            value={busCapacity}
            onChange={(e) => setBusCapacity(e.target.value)}
          />
          <Button loading={addBus.isPending} disabled={!busCode} onClick={() => addBus.mutate()}>
            Add bus
          </Button>
        </Card>

        <Card>
          <h2 className="oa-label mb-oa-2">Add a trip</h2>
          <p className="mb-oa-3 text-[13px] text-oa-ink-muted">
            One run of one bus. Bus 12 running twice gives Trip 12A and Trip 12B.
          </p>
          <Select label="Bus" value={busId} onChange={(e) => setBusId(e.target.value)}>
            <option value="">Choose a bus</option>
            {(buses.data ?? []).map((bus) => (
              <option key={bus.id} value={bus.id}>
                Bus {bus.code} ({bus.capacity} seats)
              </option>
            ))}
          </Select>
          <Field
            label="Trip code"
            value={tripCode}
            placeholder="12A"
            onChange={(e) => setTripCode(e.target.value)}
          />
          <Select
            label="Pickup point"
            value={pickupPointId}
            onChange={(e) => setPickupPointId(e.target.value)}
          >
            <option value="">Choose a pickup point</option>
            {points.map((point) => (
              <option key={point.id} value={point.id}>
                {point.name}
              </option>
            ))}
          </Select>
          <Field
            label="Departs"
            type="datetime-local"
            value={departsAt}
            onChange={(e) => setDepartsAt(e.target.value)}
          />
          <Button
            loading={addTrip.isPending}
            disabled={!busId || !tripCode || !pickupPointId || !departsAt}
            onClick={() => addTrip.mutate()}
          >
            Add trip
          </Button>
        </Card>
      </div>
    </div>
  );
}

/** GT-2: the gate poster, ready to print. */
function Gates({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('Main gate');
  const [poster, setPoster] = useState<{ name: string; dataUrl: string; url: string } | null>(null);

  const gates = useQuery({
    queryKey: ['gates', eventId],
    queryFn: () => api.get<GateRow[]>(`/events/${eventId}/gates`),
  });

  const add = useMutation({
    mutationFn: () => api.post<GateRow>(`/events/${eventId}/gates`, { name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gates', eventId] }),
  });

  const show = async (gate: GateRow) => {
    const dataUrl = await QRCode.toDataURL(gate.posterUrl, {
      width: 1200,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: { dark: '#141414', light: '#FFFFFF' },
    });
    setPoster({ name: gate.name, dataUrl, url: gate.posterUrl });
  };

  return (
    <div className="grid gap-oa-3 md:grid-cols-2">
      <Card>
        <h2 className="oa-label mb-oa-2">Gates</h2>
        <ul className="divide-y divide-oa-border">
          {(gates.data ?? []).map((gate) => (
            <li key={gate.id} className="flex items-center justify-between gap-oa-2 py-oa-2">
              <span className="text-[16px] font-semibold">{gate.name}</span>
              <Button full={false} variant="quiet" onClick={() => void show(gate)}>
                Show the poster code
              </Button>
            </li>
          ))}
          {gates.data?.length === 0 ? (
            <li className="py-oa-2 text-[15px] text-oa-ink-muted">No gates yet.</li>
          ) : null}
        </ul>
        <div className="mt-oa-3">
          <Field label="Gate name" value={name} onChange={(e) => setName(e.target.value)} />
          <Button loading={add.isPending} disabled={!name} onClick={() => add.mutate()}>
            Add gate
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="oa-label mb-oa-2">The poster</h2>
        {poster ? (
          <div className="rounded-oa-lg bg-white p-oa-3 text-center text-[#141414]">
            <p className="oa-display text-[40px] leading-none">I&apos;ve arrived</p>
            <p className="mb-oa-3 text-[15px]">Scan with your phone camera to check in.</p>
            <img
              src={poster.dataUrl}
              alt={`Gate code for ${poster.name}`}
              className="mx-auto w-full max-w-[320px]"
            />
            <p className="oa-label mt-oa-2">{poster.name}</p>
          </div>
        ) : (
          <p className="text-[15px] text-oa-ink-muted">
            Choose a gate to see its code. The code is fixed for the gathering and only works while
            the doors are open, so it can be printed days ahead.
          </p>
        )}
        {poster ? (
          <Button className="mt-oa-3" variant="quiet" onClick={() => window.print()}>
            Print
          </Button>
        ) : null}
      </Card>
    </div>
  );
}

/** EV-5 */
function Team({ eventId, points }: { eventId: string; points: PickupPointSummary[] }) {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'DELEGATE' | 'USHER' | 'ADMIN'>('DELEGATE');
  const [pickupPointId, setPickupPointId] = useState('');

  const team = useQuery({
    queryKey: ['team', eventId],
    queryFn: () => api.get<TeamRow[]>(`/events/${eventId}/team`),
  });

  const gates = useQuery({
    queryKey: ['gates', eventId],
    queryFn: () => api.get<GateRow[]>(`/events/${eventId}/gates`),
  });

  const invite = useMutation({
    mutationFn: () =>
      api.post(`/events/${eventId}/team`, {
        fullName,
        email,
        role,
        pickupPointId: role === 'DELEGATE' ? pickupPointId || undefined : undefined,
        gateId: role === 'USHER' ? gates.data?.[0]?.id : undefined,
      }),
    onSuccess: () => {
      setFullName('');
      setEmail('');
      void queryClient.invalidateQueries({ queryKey: ['team', eventId] });
    },
  });

  return (
    <div className="grid gap-oa-3 md:grid-cols-2">
      <Card>
        <h2 className="oa-label mb-oa-2">The team</h2>
        <ul className="divide-y divide-oa-border">
          {(team.data ?? []).map((member) => (
            <li
              key={`${member.id}-${member.pickupPointName ?? member.gateId ?? ''}`}
              className="py-oa-2"
            >
              <div className="flex items-baseline justify-between gap-oa-2">
                <span className="text-[16px] font-semibold">{member.fullName}</span>
                <span className="oa-label">{member.role.toLowerCase().replace('_', ' ')}</span>
              </div>
              <p className="text-[13px] text-oa-ink-muted">
                {member.email}
                {member.pickupPointName ? ` · ${member.pickupPointName}` : ''}
              </p>
            </li>
          ))}
          {team.data?.length === 0 ? (
            <li className="py-oa-2 text-[15px] text-oa-ink-muted">Nobody invited yet.</li>
          ) : null}
        </ul>
      </Card>

      <Card>
        <h2 className="oa-label mb-oa-2">Invite someone</h2>
        {invite.isSuccess ? <Banner>Invited. A sign-in link is on its way.</Banner> : null}
        <Field label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Select label="Role" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
          <option value="DELEGATE">Delegate</option>
          <option value="USHER">Usher</option>
          <option value="ADMIN">Admin</option>
        </Select>
        {role === 'DELEGATE' ? (
          <Select
            label="Pickup point"
            value={pickupPointId}
            onChange={(e) => setPickupPointId(e.target.value)}
          >
            <option value="">Choose a pickup point</option>
            {points.map((point) => (
              <option key={point.id} value={point.id}>
                {point.name}
              </option>
            ))}
          </Select>
        ) : null}
        <Button
          loading={invite.isPending}
          disabled={!fullName || !email || (role === 'DELEGATE' && !pickupPointId)}
          onClick={() => invite.mutate()}
        >
          Invite and send sign-in link
        </Button>
      </Card>
    </div>
  );
}

/** EV-6 and EV-7 */
function ImportAndCopy({ eventId, event }: { eventId: string; event: EventSummary }) {
  const [csv, setCsv] = useState('');
  const [slug, setSlug] = useState('');
  const [city, setCity] = useState('');
  const [venue, setVenue] = useState('');
  const [date, setDate] = useState('');

  const importRows = useMutation({
    mutationFn: () => api.post(`/events/${eventId}/import`, { rows: parseCsv(csv) }),
  });

  const duplicate = useMutation({
    mutationFn: () => {
      const startsAt = new Date(`${date}T17:00:00`);
      return api.post<EventSummary>(`/events/${eventId}/duplicate`, {
        slug,
        city,
        venue,
        startsAt: startsAt.toISOString(),
        doorsOpenAt: new Date(startsAt.getTime() - 3 * 3_600_000).toISOString(),
        doorsCloseAt: new Date(startsAt.getTime() + 4 * 3_600_000).toISOString(),
      });
    },
  });

  const failure = importRows.error instanceof ApiError ? importRows.error : null;

  return (
    <div className="grid gap-oa-3 md:grid-cols-2">
      <Card>
        <h2 className="oa-label mb-oa-2">Import pickup points, buses and delegates</h2>
        <p className="mb-oa-2 text-[13px] text-oa-ink-muted">
          Paste a CSV with these columns: kind, pickupPoint, address, departsAt, zoneLetter,
          busCode, capacity, tripCode, delegateEmail, delegateName. One row per trip.
        </p>
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={8}
          placeholder="kind,pickupPoint,address,departsAt,zoneLetter,busCode,capacity,tripCode,delegateEmail,delegateName"
          className="mb-oa-3 w-full rounded-oa-md border-2 border-oa-border bg-oa-surface p-oa-2 font-mono text-[13px] text-oa-ink"
        />
        {failure ? <Banner tone="error">{failure.message}</Banner> : null}
        {importRows.isSuccess ? (
          <Banner>
            Imported {(importRows.data as { pickupPoints: number }).pickupPoints} pickup points and{' '}
            {(importRows.data as { trips: number }).trips} trips.
          </Banner>
        ) : null}
        <Button
          loading={importRows.isPending}
          disabled={csv.trim().split('\n').length < 2}
          onClick={() => importRows.mutate()}
        >
          Import
        </Button>
      </Card>

      <Card>
        <h2 className="oa-label mb-oa-2">Copy this setup to another city or date</h2>
        <p className="mb-oa-3 text-[13px] text-oa-ink-muted">
          Zones, pickup points, buses and trips are copied. Departure times keep their distance from
          the start time. Nobody&apos;s registration is copied.
        </p>
        <Field
          label="City"
          value={city}
          placeholder={event.city}
          onChange={(e) => setCity(e.target.value)}
        />
        <Field
          label="Venue"
          value={venue}
          placeholder={event.venue}
          onChange={(e) => setVenue(e.target.value)}
        />
        <Field
          label="Link name"
          value={slug}
          placeholder="abuja-2026"
          onChange={(e) => setSlug(e.target.value)}
        />
        <Field label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        {duplicate.isSuccess ? <Banner>Copied. Find it on the gatherings page.</Banner> : null}
        <Button
          loading={duplicate.isPending}
          disabled={!city || !venue || !slug || !date}
          onClick={() => duplicate.mutate()}
        >
          Copy the setup
        </Button>
      </Card>
    </div>
  );
}

/** A small CSV reader: quoted fields, commas inside them, and a header row. */
export function parseCsv(text: string): Array<Record<string, unknown>> {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const character = text[i];
    if (quoted) {
      if (character === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += character;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (character !== '\r') field += character;
  }
  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const [header, ...body] = rows.filter((line) => line.some((cell) => cell.trim() !== ''));
  if (!header) return [];
  const keys = header.map((key) => key.trim());

  return body.map((line) => {
    const record: Record<string, unknown> = {};
    keys.forEach((key, index) => {
      const value = (line[index] ?? '').trim();
      if (value === '') return;
      record[key] = key === 'capacity' ? Number(value) : value;
    });
    return record;
  });
}
