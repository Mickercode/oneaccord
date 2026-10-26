/**
 * Shared contract between the API and the three web apps.
 * Enum string values match the Prisma enums one for one.
 */

export type EventStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'LIVE' | 'ENDED';
export type PickupKind = 'CAMPUS' | 'AREA';
export type TripStatus = 'SCHEDULED' | 'BOARDING' | 'DEPARTED' | 'ARRIVED';
export type RegistrationType = 'CAMPUS' | 'AREA' | 'PRIVATE' | 'WALK_IN';
export type CheckInStage = 'BOARDED' | 'ARRIVED';
export type CheckInMethod =
  'DELEGATE_CODE' | 'GATE_POSTER' | 'BY_NAME' | 'TRIP_CONFIRMED' | 'WALK_IN';
export type TeamRole = 'SUPER_ADMIN' | 'ADMIN' | 'DELEGATE' | 'USHER';

/** Pass codes read aloud in a noisy car park, so no 0, O, 1, I or L. PS-3. */
export const PASS_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const PASS_CODE_PREFIX = 'UR-';
export const PASS_CODE_LENGTH = 4;

/** BD-1 and BD-4: a new code every 30 seconds, accepted for at most 60. */
export const BOARDING_WINDOW_SECONDS = 30;
export const BOARDING_WINDOW_GRACE = 1;

export interface EventSummary {
  id: string;
  slug: string;
  city: string;
  venue: string;
  address: string | null;
  /** ISO date-time of the gathering, in the event's timezone. */
  startsAt: string;
  timezone: string;
  cityColor: string;
  status: EventStatus;
  privacyUrl: string | null;
}

export interface ZoneSummary {
  id: string;
  letter: string;
  name: string;
  color: string;
  capacity: number;
  closed: boolean;
}

export interface ZoneFill extends ZoneSummary {
  inHall: number;
  /** 0 to 1, clamped. ZN-3. */
  fill: number;
}

export interface PickupPointSummary {
  id: string;
  kind: PickupKind;
  name: string;
  address: string;
  departsAt: string;
  zone: ZoneSummary | null;
  /** RG-5: false once every trip from this point is full. */
  hasSeats: boolean;
  seatsLeft: number;
}

export interface TripSummary {
  id: string;
  code: string;
  status: TripStatus;
  capacity: number;
  departsAt: string;
  pickupPointName: string;
  delegateFirstName: string | null;
  whatsappUrl: string | null;
  boardedCount: number;
}

/** RG-1 */
export interface RegisterRequest {
  fullName: string;
  email: string;
  phone?: string;
  type: Extract<RegistrationType, 'CAMPUS' | 'AREA' | 'PRIVATE'>;
  pickupPointId?: string;
  consentData: boolean;
  consentEmail: boolean;
}

export interface RegisterResponse {
  passCode: string;
  resent: boolean;
  trip: TripSummary | null;
  zone: ZoneSummary | null;
  pickupPointName: string | null;
}

/** PS-1 and PS-2: what the pass page shows. */
export interface PassView {
  passCode: string;
  fullName: string;
  type: RegistrationType;
  event: EventSummary;
  trip: TripSummary | null;
  pickupPoint: { name: string; address: string; departsAt: string } | null;
  zone: ZoneSummary | null;
  delegateFirstName: string | null;
  whatsappUrl: string | null;
  checkedIn: { boarded: boolean; arrived: boolean };
}

export type ScanKind = 'BOARDING' | 'GATE';

/** What the check-in page needs before it asks the one question. BD-2. */
export interface ScanContext {
  kind: ScanKind;
  valid: boolean;
  reason?: 'EXPIRED' | 'BAD_TOKEN' | 'CLOSED' | 'TRIP_LOCKED' | 'OUTSIDE_HOURS';
  event: EventSummary;
  trip: TripSummary | null;
  gateName: string | null;
  /** Set when the phone already carries the UR Pass cookie. */
  attendee: { fullName: string; passCode: string; onThisTrip: boolean } | null;
}

export interface CheckInRequest {
  token: string;
  /** Only when the device is not recognised. BD-3. */
  passCode?: string;
  email?: string;
}

export interface CheckInResult {
  alreadyCheckedIn: boolean;
  stage: CheckInStage;
  fullName: string;
  passCode: string;
  zone: ZoneSummary | null;
  delegateFirstName: string | null;
  trip: TripSummary | null;
  /** BD-6: true when they boarded a trip other than the one they registered for. */
  switchedTrip: boolean;
}

export interface BoardingCodeResponse {
  /** The short link the QR encodes: /b/<token>. */
  token: string;
  url: string;
  /** Unix seconds when this token stops being the current one. */
  rotatesAt: number;
  trip: TripSummary;
  boardedCount: number;
}

export interface BoardedAttendee {
  registrationId: string;
  fullName: string;
  passCode: string;
  zoneLetter: string | null;
  boardedAt: string | null;
  method: CheckInMethod | null;
}

/** DB-1 */
export interface LiveTotals {
  registered: number;
  boarded: number;
  onTheWay: number;
  arrived: number;
  inHall: number;
}

export interface LiveSnapshot {
  eventId: string;
  at: string;
  totals: LiveTotals;
  trips: TripSummary[];
  zones: ZoneFill[];
}

/** DB-3 */
export interface BreakdownRow {
  key: string;
  label: string;
  registered: number;
  boarded: number;
  arrived: number;
}

export interface TeamSession {
  id: string;
  email: string;
  fullName: string;
  role: TeamRole;
  eventId: string | null;
  pickupPointIds: string[];
  gateIds: string[];
}

/** MS-1 */
export interface MessageRequest {
  audience: 'EVENT' | 'PICKUP_POINT' | 'TRIP';
  audienceId?: string;
  subject: string;
  body: string;
  essential: boolean;
}

export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
}
