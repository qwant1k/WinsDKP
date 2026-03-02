ALTER TYPE "DkpTransactionType" ADD VALUE IF NOT EXISTS 'SLOT_BET';
ALTER TYPE "DkpTransactionType" ADD VALUE IF NOT EXISTS 'SLOT_WIN';

CREATE TABLE IF NOT EXISTS "slot_spins" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "clan_id" UUID NOT NULL,
  "tier" TEXT NOT NULL,
  "multiplier" DOUBLE PRECISION NOT NULL,
  "payout" DOUBLE PRECISION NOT NULL,
  "seed" TEXT NOT NULL,
  "spin_hash" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "slot_spins_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "slot_spins_clan_id_created_at_idx"
  ON "slot_spins"("clan_id", "created_at");

CREATE INDEX IF NOT EXISTS "slot_spins_user_id_created_at_idx"
  ON "slot_spins"("user_id", "created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'slot_spins_user_id_fkey'
  ) THEN
    ALTER TABLE "slot_spins"
      ADD CONSTRAINT "slot_spins_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'slot_spins_clan_id_fkey'
  ) THEN
    ALTER TABLE "slot_spins"
      ADD CONSTRAINT "slot_spins_clan_id_fkey"
      FOREIGN KEY ("clan_id") REFERENCES "clans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
