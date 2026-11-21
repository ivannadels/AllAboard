-- CreateTable
CREATE TABLE "Station" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "lat" REAL NOT NULL,
    "lon" REAL NOT NULL
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "travelers" INTEGER NOT NULL DEFAULT 1,
    "budgetCents" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Variant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tripId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Variant_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Leg" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "variantId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "originStationId" TEXT NOT NULL,
    "destStationId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "notes" TEXT,
    CONSTRAINT "Leg_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Leg_originStationId_fkey" FOREIGN KEY ("originStationId") REFERENCES "Station" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Leg_destStationId_fkey" FOREIGN KEY ("destStationId") REFERENCES "Station" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Option" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "legId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "departAt" DATETIME NOT NULL,
    "arriveAt" DATETIME NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "distanceKm" REAL NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "co2Grams" INTEGER NOT NULL,
    "bookingUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CANDIDATE',
    "source" TEXT NOT NULL DEFAULT 'mock',
    "seatsLeft" INTEGER,
    "priceAdjustPct" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "Option_legId_fkey" FOREIGN KEY ("legId") REFERENCES "Leg" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PriceSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "optionId" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "checkedAt" DATETIME NOT NULL,
    CONSTRAINT "PriceSnapshot_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "Option" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "optionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "thresholdPct" REAL NOT NULL DEFAULT 5,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Alert_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "Option" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "alertId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Notification_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Notification_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "Option" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgendaItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "variantId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "time" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "location" TEXT,
    "costCents" INTEGER,
    CONSTRAINT "AgendaItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SimClock" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "now" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Variant_tripId_idx" ON "Variant"("tripId");

-- CreateIndex
CREATE INDEX "Leg_variantId_idx" ON "Leg"("variantId");

-- CreateIndex
CREATE INDEX "Option_legId_idx" ON "Option"("legId");

-- CreateIndex
CREATE INDEX "PriceSnapshot_optionId_checkedAt_idx" ON "PriceSnapshot"("optionId", "checkedAt");

-- CreateIndex
CREATE INDEX "Alert_optionId_idx" ON "Alert"("optionId");

-- CreateIndex
CREATE INDEX "Notification_read_createdAt_idx" ON "Notification"("read", "createdAt");

-- CreateIndex
CREATE INDEX "AgendaItem_variantId_date_idx" ON "AgendaItem"("variantId", "date");
