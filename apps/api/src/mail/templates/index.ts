import { DateTime } from 'luxon';
import { button, dateStrip, escapeHtml, layout, row, toText } from './layout';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface PassContext {
  fullName: string;
  passCode: string;
  city: string;
  venue: string;
  cityColour: string;
  startsAt: Date;
  timezone: string;
  passUrl: string;
  unsubscribeUrl: string;
  trip?: {
    code: string;
    departsAt: Date;
    pickupPointName: string;
    pickupPointAddress: string;
    delegateFirstName: string | null;
    whatsappUrl: string | null;
  } | null;
  zoneLetter?: string | null;
}

function parts(at: Date, timezone: string) {
  const local = DateTime.fromJSDate(at).setZone(timezone);
  return {
    day: local.toFormat('ccc d').toUpperCase(),
    monthYear: local.toFormat('LLL yyyy').toUpperCase(),
    time: local.toFormat('h:mma').toLowerCase().replace(':00', ''),
    full: local.toFormat('cccc d LLLL, h:mm a'),
    clock: local.toFormat('h:mm a'),
  };
}

/** PS-1: the UR Pass itself. */
export function passEmail(context: PassContext): RenderedEmail {
  const event = parts(context.startsAt, context.timezone);
  const name = escapeHtml(context.fullName.split(' ')[0] ?? context.fullName);
  const trip = context.trip;
  const departure = trip ? parts(trip.departsAt, context.timezone) : null;

  const rows = [
    row(
      'Pass code',
      `<strong style="font-family:Archivo,Arial,sans-serif;font-size:22px;letter-spacing:0.12em">${escapeHtml(context.passCode)}</strong>`,
    ),
    row('Venue', escapeHtml(context.venue)),
    trip ? row('Trip', escapeHtml(trip.code)) : '',
    trip
      ? row(
          'Pickup',
          `${escapeHtml(trip.pickupPointName)}<br><span style="color:#5C554C;font-size:13px">${escapeHtml(trip.pickupPointAddress)}</span>`,
        )
      : '',
    departure ? row('Departs', escapeHtml(departure.clock)) : '',
    trip?.delegateFirstName ? row('Your delegate', escapeHtml(trip.delegateFirstName)) : '',
    context.zoneLetter ? row('Zone', `Zone ${escapeHtml(context.zoneLetter)}`) : '',
  ]
    .filter(Boolean)
    .join('');

  const whatsapp = trip?.whatsappUrl
    ? `<p style="font-family:Archivo,Arial,sans-serif;font-size:16px;line-height:24px;color:#141414;margin:20px 0 0">Your trip has a WhatsApp group, run by your delegate: <a href="${trip.whatsappUrl}" style="color:#C81E1E">join it here</a>.</p>`
    : '';

  const instruction = trip
    ? `On the bus, your delegate will show a code. Scan it with your phone camera to check in, then collect your zone tag.`
    : `When you arrive, scan the "I've arrived" poster in the security queue to check in.`;

  const body = `
    <p style="font-family:'Barlow Condensed',Arial,sans-serif;font-style:italic;font-weight:800;font-size:40px;line-height:1;margin:0 0 16px;text-transform:uppercase;color:#141414">You're registered</p>
    ${dateStrip(event)}
    <p style="font-family:Archivo,Arial,sans-serif;font-size:16px;line-height:24px;color:#141414;margin:0 0 20px">
      ${name}, here's your UR Pass for Upper Room ${escapeHtml(context.city)}. ${escapeHtml(instruction)}
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
    ${button('Open your UR Pass', context.passUrl)}
    <p style="font-family:Archivo,Arial,sans-serif;font-size:13px;line-height:18px;color:#5C554C;margin:0">
      Open it on the phone you'll bring, so we recognise you at check-in. No phone on the day? Your delegate can check you in by name.
    </p>
    ${whatsapp}`;

  return {
    subject: `Your UR Pass for Upper Room ${context.city} — ${context.passCode}`,
    html: layout({
      title: 'Your UR Pass',
      preheader: `${context.passCode} · ${trip ? trip.code : context.venue} · ${event.full}`,
      cityName: context.city,
      cityColour: context.cityColour,
      body,
      unsubscribeUrl: context.unsubscribeUrl,
    }),
    text: toText([
      `You're registered.`,
      ``,
      `Upper Room ${context.city} — ${context.venue}`,
      `${event.full}`,
      ``,
      `Pass code: ${context.passCode}`,
      trip ? `Trip: ${trip.code}` : '',
      trip ? `Pickup: ${trip.pickupPointName}, ${trip.pickupPointAddress}` : '',
      departure ? `Departs: ${departure.clock}` : '',
      trip?.delegateFirstName ? `Your delegate: ${trip.delegateFirstName}` : '',
      context.zoneLetter ? `Zone: ${context.zoneLetter}` : '',
      ``,
      instruction,
      ``,
      `Open your UR Pass: ${context.passUrl}`,
      ``,
      `Unsubscribe: ${context.unsubscribeUrl}`,
    ]),
  };
}

export type ReminderKind = 'DAY_BEFORE' | 'THREE_HOURS';

/** PS-4 */
export function reminderEmail(context: PassContext, kind: ReminderKind): RenderedEmail {
  const trip = context.trip;
  const when = trip
    ? parts(trip.departsAt, context.timezone)
    : parts(context.startsAt, context.timezone);
  const name = escapeHtml(context.fullName.split(' ')[0] ?? context.fullName);

  const headline = kind === 'DAY_BEFORE' ? 'Tomorrow' : 'In three hours';
  const line = trip
    ? `Upper Room ${escapeHtml(context.city)} is ${kind === 'DAY_BEFORE' ? 'tomorrow' : 'today'}. Your trip leaves ${escapeHtml(trip.pickupPointName)} at ${when.clock}.`
    : `Upper Room ${escapeHtml(context.city)} is ${kind === 'DAY_BEFORE' ? 'tomorrow' : 'today'} at ${escapeHtml(context.venue)}, ${when.clock}.`;

  const body = `
    <p style="font-family:'Barlow Condensed',Arial,sans-serif;font-style:italic;font-weight:800;font-size:40px;line-height:1;margin:0 0 16px;text-transform:uppercase;color:#141414">${headline}</p>
    ${dateStrip(parts(context.startsAt, context.timezone))}
    <p style="font-family:Archivo,Arial,sans-serif;font-size:16px;line-height:24px;color:#141414;margin:0 0 8px">${name}, ${line}</p>
    <p style="font-family:Archivo,Arial,sans-serif;font-size:16px;line-height:24px;color:#141414;margin:0">Your pass code is <strong>${escapeHtml(context.passCode)}</strong>. Have it ready.</p>
    ${button('Open your UR Pass', context.passUrl)}`;

  return {
    subject:
      kind === 'DAY_BEFORE'
        ? `Upper Room ${context.city} is tomorrow`
        : `Your trip leaves at ${when.clock}`,
    html: layout({
      title: 'Reminder',
      preheader: line.replace(/<[^>]+>/g, ''),
      cityName: context.city,
      cityColour: context.cityColour,
      body,
      unsubscribeUrl: context.unsubscribeUrl,
    }),
    text: toText([
      headline,
      '',
      line.replace(/<[^>]+>/g, ''),
      `Pass code: ${context.passCode}`,
      '',
      `Open your UR Pass: ${context.passUrl}`,
      '',
      `Unsubscribe: ${context.unsubscribeUrl}`,
    ]),
  };
}

/** MS-1: a note from the team to a trip, a pickup point or everyone. */
export function teamMessageEmail(context: {
  fullName: string;
  city: string;
  cityColour: string;
  subject: string;
  body: string;
  passUrl: string;
  unsubscribeUrl?: string;
}): RenderedEmail {
  const paragraphs = context.body
    .split(/\n{2,}/)
    .map(
      (paragraph) =>
        `<p style="font-family:Archivo,Arial,sans-serif;font-size:16px;line-height:24px;color:#141414;margin:0 0 16px">${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`,
    )
    .join('');

  const body = `
    <p style="font-family:'Barlow Condensed',Arial,sans-serif;font-style:italic;font-weight:800;font-size:28px;line-height:1.05;margin:0 0 16px;text-transform:uppercase;color:#141414">${escapeHtml(context.subject)}</p>
    ${paragraphs}
    ${button('Open your UR Pass', context.passUrl)}`;

  return {
    subject: context.subject,
    html: layout({
      title: context.subject,
      preheader: context.body.slice(0, 120),
      cityName: context.city,
      cityColour: context.cityColour,
      body,
      unsubscribeUrl: context.unsubscribeUrl,
    }),
    text: toText([context.subject, '', context.body, '', `Your UR Pass: ${context.passUrl}`]),
  };
}

/** EV-5: how delegates, ushers and admins sign in. */
export function magicLinkEmail(context: {
  fullName: string;
  role: string;
  signInUrl: string;
  city: string;
  cityColour: string;
  minutes: number;
}): RenderedEmail {
  const name = escapeHtml(context.fullName.split(' ')[0] ?? context.fullName);
  const body = `
    <p style="font-family:'Barlow Condensed',Arial,sans-serif;font-style:italic;font-weight:800;font-size:40px;line-height:1;margin:0 0 16px;text-transform:uppercase;color:#141414">Sign in</p>
    <p style="font-family:Archivo,Arial,sans-serif;font-size:16px;line-height:24px;color:#141414;margin:0 0 8px">
      ${name}, here's your link into One Accord. It works once and lasts ${context.minutes} minutes.
    </p>
    ${button('Sign in to One Accord', context.signInUrl)}
    <p style="font-family:Archivo,Arial,sans-serif;font-size:13px;line-height:18px;color:#5C554C;margin:0">
      If you didn't ask for this, you can ignore it.
    </p>`;

  return {
    subject: 'Your One Accord sign-in link',
    html: layout({
      title: 'Sign in to One Accord',
      preheader: `Your link works once and lasts ${context.minutes} minutes.`,
      cityName: context.city,
      cityColour: context.cityColour,
      body,
    }),
    text: toText([
      `Sign in to One Accord`,
      '',
      `This link works once and lasts ${context.minutes} minutes:`,
      context.signInUrl,
    ]),
  };
}
