import { createHmac } from 'node:crypto';
import type { AppConfig } from '../common/config';
import type { PassContext } from './templates';

/** The shape every mail template needs, gathered once. */
export interface RegistrationForMail {
  id: string;
  fullName: string;
  email: string;
  passCode: string;
  zone: { letter: string } | null;
  trip: {
    code: string;
    departsAt: Date;
    whatsappUrl: string | null;
    delegate: { fullName: string } | null;
    pickupPoint: { name: string; address: string };
  } | null;
  event: {
    city: string;
    venue: string;
    cityColor: string;
    startsAt: Date;
    timezone: string;
  };
}

export function unsubscribeToken(registrationId: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(`u:${registrationId}`)
    .digest('base64url')
    .slice(0, 22);
}

export function passContext(registration: RegistrationForMail, config: AppConfig): PassContext {
  const token = unsubscribeToken(registration.id, config.secret);
  return {
    fullName: registration.fullName,
    passCode: registration.passCode,
    city: registration.event.city,
    venue: registration.event.venue,
    cityColour: registration.event.cityColor,
    startsAt: registration.event.startsAt,
    timezone: registration.event.timezone,
    passUrl: `${config.webUrl.replace(/\/$/, '')}/pass/${registration.passCode}`,
    unsubscribeUrl: `${config.webUrl.replace(/\/$/, '')}/unsubscribe/${registration.id}/${token}`,
    zoneLetter: registration.zone?.letter ?? null,
    trip: registration.trip
      ? {
          code: registration.trip.code,
          departsAt: registration.trip.departsAt,
          pickupPointName: registration.trip.pickupPoint.name,
          pickupPointAddress: registration.trip.pickupPoint.address,
          delegateFirstName: registration.trip.delegate?.fullName.split(' ')[0] ?? null,
          whatsappUrl: registration.trip.whatsappUrl,
        }
      : null,
  };
}

/** The include clause that fills RegistrationForMail. */
export const MAIL_INCLUDE = {
  zone: { select: { letter: true } },
  event: { select: { city: true, venue: true, cityColor: true, startsAt: true, timezone: true } },
  trip: {
    select: {
      code: true,
      departsAt: true,
      whatsappUrl: true,
      delegate: { select: { fullName: true } },
      pickupPoint: { select: { name: true, address: true } },
    },
  },
} as const;
