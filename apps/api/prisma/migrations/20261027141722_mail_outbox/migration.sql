-- CreateTable
CREATE TABLE "OutboxEmail" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sendAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OutboxEmail_sentAt_sendAfter_idx" ON "OutboxEmail"("sentAt", "sendAfter");
