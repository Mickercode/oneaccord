import { useQuery } from '@tanstack/react-query';
import type { EventSummary, PickupPointSummary, ZoneSummary } from '@oa/types';
import { api } from './api';

export interface PublicEvent {
  event: EventSummary;
  zones: ZoneSummary[];
  pickupPoints: PickupPointSummary[];
}

export function useEvent(eventId: string | null) {
  return useQuery({
    queryKey: ['event', eventId],
    queryFn: () => api.get<PublicEvent>(`/events/${eventId}/public`),
    enabled: !!eventId,
    staleTime: 10 * 60_000,
  });
}

/** Times always read in the event's own timezone, never the phone's. */
export function useTimezone(eventId: string | null): string {
  return useEvent(eventId).data?.event.timezone ?? 'Africa/Lagos';
}
