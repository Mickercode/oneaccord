import type { EventSummary, TripSummary, ZoneSummary } from '@oa/types';

/** The include clause that fills TripSummary. */
export const TRIP_INCLUDE = {
  pickupPoint: { select: { name: true } },
  delegate: { select: { fullName: true } },
} as const;

export interface TripRow {
  id: string;
  code: string;
  status: string;
  capacity: number;
  departsAt: Date;
  whatsappUrl: string | null;
  pickupPoint: { name: string };
  delegate: { fullName: string } | null;
}

export function tripSummary(trip: TripRow, boardedCount: number): TripSummary {
  return {
    id: trip.id,
    code: trip.code,
    status: trip.status as TripSummary['status'],
    capacity: trip.capacity,
    departsAt: trip.departsAt.toISOString(),
    pickupPointName: trip.pickupPoint.name,
    delegateFirstName: trip.delegate?.fullName.split(' ')[0] ?? null,
    whatsappUrl: trip.whatsappUrl,
    boardedCount,
  };
}

export interface ZoneRow {
  id: string;
  letter: string;
  name: string;
  color: string;
  capacity: number;
  closed: boolean;
}

export function zoneSummary(zone: ZoneRow): ZoneSummary {
  return {
    id: zone.id,
    letter: zone.letter,
    name: zone.name,
    color: zone.color,
    capacity: zone.capacity,
    closed: zone.closed,
  };
}

export interface EventRow {
  id: string;
  slug: string;
  city: string;
  venue: string;
  address: string | null;
  startsAt: Date;
  timezone: string;
  cityColor: string;
  status: string;
  privacyUrl: string | null;
}

export function eventSummary(event: EventRow): EventSummary {
  return {
    id: event.id,
    slug: event.slug,
    city: event.city,
    venue: event.venue,
    address: event.address,
    startsAt: event.startsAt.toISOString(),
    timezone: event.timezone,
    cityColor: event.cityColor,
    status: event.status as EventSummary['status'],
    privacyUrl: event.privacyUrl,
  };
}
