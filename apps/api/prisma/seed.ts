/**
 * A pilot-sized Upper Room Lagos, so every screen has something real to show.
 * Run with: pnpm db:seed
 */
import 'dotenv/config';
import { PrismaClient, type PickupKind } from '@prisma/client';
import { randomInt } from 'node:crypto';

const prisma = new PrismaClient();

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const used = new Set<string>();

function passCode(): string {
  for (;;) {
    let body = '';
    for (let i = 0; i < 4; i += 1) body += ALPHABET[randomInt(ALPHABET.length)];
    const code = `UR-${body}`;
    if (!used.has(code)) {
      used.add(code);
      return code;
    }
  }
}

/** The gathering is the coming Saturday at 5pm Lagos time. */
function nextSaturdayAt(hour: number, minute = 0): Date {
  const now = new Date();
  const date = new Date(now);
  date.setUTCHours(hour - 1, minute, 0, 0); // Lagos is UTC+1, with no DST.
  const daysAhead = (6 - date.getUTCDay() + 7) % 7 || 7;
  date.setUTCDate(date.getUTCDate() + daysAhead);
  return date;
}

const FIRST = [
  'Ada',
  'Tolu',
  'Chidi',
  'Ife',
  'Zainab',
  'Emeka',
  'Bisi',
  'Kunle',
  'Ngozi',
  'Seun',
  'Dami',
  'Funke',
];
const LAST = [
  'Okafor',
  'Adeyemi',
  'Balogun',
  'Eze',
  'Bello',
  'Nwosu',
  'Oyelaran',
  'Abiodun',
  'Chukwu',
  'Lawal',
];

function person(index: number): { fullName: string; email: string } {
  const first = FIRST[index % FIRST.length];
  const last = LAST[Math.floor(index / FIRST.length) % LAST.length];
  return {
    fullName: `${first} ${last}`,
    email: `${first}.${last}${index}`.toLowerCase() + '@example.com',
  };
}

async function main(): Promise<void> {
  const startsAt = nextSaturdayAt(17);

  await prisma.event.deleteMany({ where: { slug: 'lagos-2026' } });

  const event = await prisma.event.create({
    data: {
      slug: 'lagos-2026',
      city: 'Lagos',
      venue: 'Trinity Towers',
      address: '1 Trinity Avenue, Lekki, Lagos',
      startsAt,
      doorsOpenAt: new Date(startsAt.getTime() - 3 * 3_600_000),
      doorsCloseAt: new Date(startsAt.getTime() + 4 * 3_600_000),
      timezone: 'Africa/Lagos',
      cityColor: '#F5C400',
      status: 'LIVE',
      privacyUrl: 'https://oneaccord.example/privacy',
    },
  });

  const zoneSpec = [
    { letter: 'A', name: 'Front, centre', color: '#E52A2A', capacity: 1200 },
    { letter: 'B', name: 'Front, left', color: '#F5C400', capacity: 1200 },
    { letter: 'C', name: 'Middle, centre', color: '#F28C28', capacity: 1800 },
    { letter: 'D', name: 'Balcony', color: '#1E8A4C', capacity: 2000 },
  ];
  const zones = await Promise.all(
    zoneSpec.map((zone) => prisma.zone.create({ data: { ...zone, eventId: event.id } })),
  );
  const zoneByLetter = Object.fromEntries(zones.map((zone) => [zone.letter, zone]));

  const admin = await prisma.teamMember.upsert({
    where: { email: 'admin@oneaccord.example' },
    update: {},
    create: { email: 'admin@oneaccord.example', fullName: 'Grace Adeniyi', role: 'SUPER_ADMIN' },
  });

  const gate = await prisma.gate.create({ data: { eventId: event.id, name: 'Main gate' } });

  const usher = await prisma.teamMember.upsert({
    where: { email: 'usher@oneaccord.example' },
    update: {},
    create: { email: 'usher@oneaccord.example', fullName: 'Samuel Okon', role: 'USHER' },
  });

  await prisma.assignment.create({
    data: { teamMemberId: admin.id, eventId: event.id },
  });
  await prisma.assignment.create({
    data: { teamMemberId: usher.id, eventId: event.id, gateId: gate.id },
  });

  const pointSpec: Array<{
    kind: PickupKind;
    name: string;
    address: string;
    zone: string;
    delegate: { name: string; email: string };
    buses: Array<{ code: string; capacity: number; runs: number }>;
    departsInHours: number;
  }> = [
    {
      kind: 'CAMPUS',
      name: 'UNILAG main gate',
      address: 'University of Lagos, Akoka',
      zone: 'C',
      delegate: { name: 'Tolu Adeyemi', email: 'tolu@oneaccord.example' },
      buses: [{ code: '12', capacity: 60, runs: 2 }],
      departsInHours: 3,
    },
    {
      kind: 'CAMPUS',
      name: 'LASU main gate',
      address: 'Lagos State University, Ojo',
      zone: 'C',
      delegate: { name: 'Chidi Eze', email: 'chidi@oneaccord.example' },
      buses: [{ code: '13', capacity: 60, runs: 1 }],
      departsInHours: 3.5,
    },
    {
      kind: 'CAMPUS',
      name: 'YABATECH gate',
      address: 'Yaba College of Technology, Yaba',
      zone: 'B',
      delegate: { name: 'Ife Balogun', email: 'ife@oneaccord.example' },
      buses: [{ code: '14', capacity: 50, runs: 1 }],
      departsInHours: 3,
    },
    {
      kind: 'AREA',
      name: 'Ikeja, Alausa',
      address: 'Alausa Secretariat car park, Ikeja',
      zone: 'D',
      delegate: { name: 'Zainab Bello', email: 'zainab@oneaccord.example' },
      buses: [{ code: '20', capacity: 60, runs: 1 }],
      departsInHours: 2.5,
    },
    {
      kind: 'AREA',
      name: 'Surulere, National Stadium',
      address: 'National Stadium car park, Surulere',
      zone: 'D',
      delegate: { name: 'Emeka Nwosu', email: 'emeka@oneaccord.example' },
      buses: [{ code: '21', capacity: 60, runs: 1 }],
      departsInHours: 2.5,
    },
  ];

  const trips: Array<{ id: string; capacity: number; code: string }> = [];

  for (const spec of pointSpec) {
    const departsAt = new Date(startsAt.getTime() - spec.departsInHours * 3_600_000);

    const delegate = await prisma.teamMember.upsert({
      where: { email: spec.delegate.email },
      update: {},
      create: { email: spec.delegate.email, fullName: spec.delegate.name, role: 'DELEGATE' },
    });

    const point = await prisma.pickupPoint.create({
      data: {
        eventId: event.id,
        kind: spec.kind,
        name: spec.name,
        address: spec.address,
        departsAt,
        zoneId: zoneByLetter[spec.zone].id,
      },
    });

    await prisma.assignment.create({
      data: { teamMemberId: delegate.id, eventId: event.id, pickupPointId: point.id },
    });

    for (const bus of spec.buses) {
      const created = await prisma.bus.create({
        data: { eventId: event.id, code: bus.code, capacity: bus.capacity },
      });
      for (let run = 0; run < bus.runs; run += 1) {
        const code = `${bus.code}${String.fromCharCode(65 + run)}`;
        const trip = await prisma.trip.create({
          data: {
            eventId: event.id,
            busId: created.id,
            pickupPointId: point.id,
            code,
            capacity: bus.capacity,
            departsAt: new Date(departsAt.getTime() + run * 45 * 60_000),
            delegateId: delegate.id,
            whatsappUrl: run === 0 ? 'https://chat.whatsapp.com/example' : null,
          },
        });
        trips.push({ id: trip.id, capacity: trip.capacity, code: trip.code });
      }
    }
  }

  // Fill the trips about three quarters full, plus some private attendees.
  let index = 0;
  for (const trip of trips) {
    const tripRow = await prisma.trip.findUniqueOrThrow({
      where: { id: trip.id },
      include: { pickupPoint: true },
    });
    const count = Math.floor(trip.capacity * 0.75);
    for (let i = 0; i < count; i += 1) {
      const who = person(index++);
      await prisma.registration.create({
        data: {
          eventId: event.id,
          fullName: who.fullName,
          email: who.email,
          type: tripRow.pickupPoint.kind,
          pickupPointId: tripRow.pickupPointId,
          tripId: trip.id,
          zoneId: tripRow.pickupPoint.zoneId,
          passCode: passCode(),
          consentData: true,
          consentEmail: true,
        },
      });
    }
  }

  for (let i = 0; i < 120; i += 1) {
    const who = person(index++);
    await prisma.registration.create({
      data: {
        eventId: event.id,
        fullName: who.fullName,
        email: who.email,
        type: 'PRIVATE',
        passCode: passCode(),
        consentData: true,
        consentEmail: true,
      },
    });
  }

  // One trip already boarding, so the delegate screen opens on something live.
  const firstTrip = trips[0];
  const boarding = await prisma.registration.findMany({
    where: { tripId: firstTrip.id },
    take: 28,
    orderBy: { fullName: 'asc' },
  });
  await prisma.checkIn.createMany({
    data: boarding.map((registration) => ({
      registrationId: registration.id,
      stage: 'BOARDED' as const,
      method: 'DELEGATE_CODE' as const,
      tripId: firstTrip.id,
      zoneId: registration.zoneId,
    })),
    skipDuplicates: true,
  });
  await prisma.trip.update({ where: { id: firstTrip.id }, data: { status: 'BOARDING' } });

  const totals = await prisma.registration.count({ where: { eventId: event.id } });
  const sample = await prisma.registration.findFirst({
    where: { eventId: event.id, tripId: firstTrip.id },
    select: { passCode: true, fullName: true },
  });

  console.log(`
Upper Room ${event.city} seeded.

  Event        ${event.slug} (${event.id})
  Registered   ${totals}
  Trips        ${trips.map((trip) => trip.code).join(', ')}
  Gate poster  ${gate.name} (${gate.id})

Sign in (magic links print to the API log when MAIL_PROVIDER=console):
  Admin     admin@oneaccord.example
  Delegate  tolu@oneaccord.example
  Usher     usher@oneaccord.example

A pass to try: ${sample?.passCode} (${sample?.fullName})
`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
