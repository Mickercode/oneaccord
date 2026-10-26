-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'LIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "PickupKind" AS ENUM ('CAMPUS', 'AREA');

-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('SCHEDULED', 'BOARDING', 'DEPARTED', 'ARRIVED');

-- CreateEnum
CREATE TYPE "RegistrationType" AS ENUM ('CAMPUS', 'AREA', 'PRIVATE', 'WALK_IN');

-- CreateEnum
CREATE TYPE "CheckInStage" AS ENUM ('BOARDED', 'ARRIVED');

-- CreateEnum
CREATE TYPE "CheckInMethod" AS ENUM ('DELEGATE_CODE', 'GATE_POSTER', 'BY_NAME', 'TRIP_CONFIRMED', 'WALK_IN');

-- CreateEnum
CREATE TYPE "TeamRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'DELEGATE', 'USHER');

-- CreateEnum
CREATE TYPE "MessageAudience" AS ENUM ('EVENT', 'PICKUP_POINT', 'TRIP');

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "address" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Lagos',
    "doorsOpenAt" TIMESTAMP(3) NOT NULL,
    "doorsCloseAt" TIMESTAMP(3) NOT NULL,
    "cityColor" TEXT NOT NULL DEFAULT '#F5C400',
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "privacyUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Zone" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "letter" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "closed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickupPoint" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "kind" "PickupKind" NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "departsAt" TIMESTAMP(3) NOT NULL,
    "zoneId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PickupPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bus" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "plate" TEXT,

    CONSTRAINT "Bus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "busId" TEXT NOT NULL,
    "pickupPointId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "departsAt" TIMESTAMP(3) NOT NULL,
    "status" "TripStatus" NOT NULL DEFAULT 'SCHEDULED',
    "delegateId" TEXT,
    "whatsappUrl" TEXT,
    "departedAt" TIMESTAMP(3),
    "arrivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gate" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Gate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Registration" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "type" "RegistrationType" NOT NULL,
    "pickupPointId" TEXT,
    "tripId" TEXT,
    "zoneId" TEXT,
    "passCode" TEXT NOT NULL,
    "consentData" BOOLEAN NOT NULL DEFAULT false,
    "consentEmail" BOOLEAN NOT NULL DEFAULT false,
    "deviceVersion" INTEGER NOT NULL DEFAULT 1,
    "unsubscribed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckIn" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "stage" "CheckInStage" NOT NULL,
    "method" "CheckInMethod" NOT NULL,
    "tripId" TEXT,
    "zoneId" TEXT,
    "gateId" TEXT,
    "confirmedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "TeamRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "teamMemberId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "pickupPointId" TEXT,
    "gateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderLog" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MagicLink" (
    "id" TEXT NOT NULL,
    "teamMemberId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MagicLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "audience" "MessageAudience" NOT NULL,
    "audienceId" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "essential" BOOLEAN NOT NULL DEFAULT false,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");

-- CreateIndex
CREATE INDEX "Event_status_idx" ON "Event"("status");

-- CreateIndex
CREATE INDEX "Zone_eventId_idx" ON "Zone"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Zone_eventId_letter_key" ON "Zone"("eventId", "letter");

-- CreateIndex
CREATE INDEX "PickupPoint_eventId_kind_idx" ON "PickupPoint"("eventId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "PickupPoint_eventId_name_key" ON "PickupPoint"("eventId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Bus_eventId_code_key" ON "Bus"("eventId", "code");

-- CreateIndex
CREATE INDEX "Trip_pickupPointId_departsAt_idx" ON "Trip"("pickupPointId", "departsAt");

-- CreateIndex
CREATE INDEX "Trip_eventId_status_idx" ON "Trip"("eventId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Trip_eventId_code_key" ON "Trip"("eventId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Gate_eventId_name_key" ON "Gate"("eventId", "name");

-- CreateIndex
CREATE INDEX "Registration_eventId_type_idx" ON "Registration"("eventId", "type");

-- CreateIndex
CREATE INDEX "Registration_tripId_idx" ON "Registration"("tripId");

-- CreateIndex
CREATE INDEX "Registration_eventId_fullName_idx" ON "Registration"("eventId", "fullName");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_eventId_email_key" ON "Registration"("eventId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_eventId_passCode_key" ON "Registration"("eventId", "passCode");

-- CreateIndex
CREATE INDEX "CheckIn_tripId_stage_idx" ON "CheckIn"("tripId", "stage");

-- CreateIndex
CREATE INDEX "CheckIn_zoneId_stage_idx" ON "CheckIn"("zoneId", "stage");

-- CreateIndex
CREATE INDEX "CheckIn_createdAt_idx" ON "CheckIn"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CheckIn_registrationId_stage_key" ON "CheckIn"("registrationId", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_email_key" ON "TeamMember"("email");

-- CreateIndex
CREATE INDEX "Assignment_eventId_idx" ON "Assignment"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_teamMemberId_eventId_pickupPointId_gateId_key" ON "Assignment"("teamMemberId", "eventId", "pickupPointId", "gateId");

-- CreateIndex
CREATE INDEX "ReminderLog_sentAt_idx" ON "ReminderLog"("sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderLog_registrationId_kind_key" ON "ReminderLog"("registrationId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "MagicLink_tokenHash_key" ON "MagicLink"("tokenHash");

-- CreateIndex
CREATE INDEX "MagicLink_expiresAt_idx" ON "MagicLink"("expiresAt");

-- CreateIndex
CREATE INDEX "Message_eventId_createdAt_idx" ON "Message"("eventId", "createdAt");

-- AddForeignKey
ALTER TABLE "Zone" ADD CONSTRAINT "Zone_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupPoint" ADD CONSTRAINT "PickupPoint_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupPoint" ADD CONSTRAINT "PickupPoint_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bus" ADD CONSTRAINT "Bus_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_busId_fkey" FOREIGN KEY ("busId") REFERENCES "Bus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_pickupPointId_fkey" FOREIGN KEY ("pickupPointId") REFERENCES "PickupPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_delegateId_fkey" FOREIGN KEY ("delegateId") REFERENCES "TeamMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gate" ADD CONSTRAINT "Gate_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_pickupPointId_fkey" FOREIGN KEY ("pickupPointId") REFERENCES "PickupPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_gateId_fkey" FOREIGN KEY ("gateId") REFERENCES "Gate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "TeamMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_pickupPointId_fkey" FOREIGN KEY ("pickupPointId") REFERENCES "PickupPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicLink" ADD CONSTRAINT "MagicLink_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "TeamMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
