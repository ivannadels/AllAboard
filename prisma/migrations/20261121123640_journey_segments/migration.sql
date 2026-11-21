-- CreateTable
CREATE TABLE "Segment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "optionId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "originStationId" TEXT NOT NULL,
    "destStationId" TEXT NOT NULL,
    "departAt" DATETIME NOT NULL,
    "arriveAt" DATETIME NOT NULL,
    "distanceKm" REAL NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "co2Grams" INTEGER NOT NULL,
    CONSTRAINT "Segment_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "Option" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Segment_originStationId_fkey" FOREIGN KEY ("originStationId") REFERENCES "Station" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Segment_destStationId_fkey" FOREIGN KEY ("destStationId") REFERENCES "Station" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Option" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "legId" TEXT NOT NULL,
    "externalId" TEXT,
    "mode" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "changes" INTEGER NOT NULL DEFAULT 0,
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
INSERT INTO "new_Option" ("arriveAt", "bookingUrl", "co2Grams", "currency", "departAt", "distanceKm", "durationMin", "id", "legId", "mode", "operator", "priceAdjustPct", "priceCents", "seatsLeft", "source", "status") SELECT "arriveAt", "bookingUrl", "co2Grams", "currency", "departAt", "distanceKm", "durationMin", "id", "legId", "mode", "operator", "priceAdjustPct", "priceCents", "seatsLeft", "source", "status" FROM "Option";
DROP TABLE "Option";
ALTER TABLE "new_Option" RENAME TO "Option";
CREATE INDEX "Option_legId_idx" ON "Option"("legId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Segment_optionId_idx" ON "Segment"("optionId");
