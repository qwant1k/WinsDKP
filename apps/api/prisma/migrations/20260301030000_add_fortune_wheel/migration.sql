ALTER TYPE "DkpTransactionType" ADD VALUE IF NOT EXISTS 'FORTUNE_SPIN';
ALTER TYPE "WarehouseMovementType" ADD VALUE IF NOT EXISTS 'FORTUNE_WIN';

ALTER TABLE "warehouse_items"
  ADD COLUMN IF NOT EXISTS "available_in_fortune" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "fortune_spins" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "clan_id" UUID NOT NULL,
  "bet" INTEGER NOT NULL,
  "won_item_id" UUID,
  "won_rarity" "ItemRarity" NOT NULL,
  "dkp_spent" INTEGER NOT NULL,
  "spin_hash" TEXT NOT NULL,
  "seed" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "fortune_spins_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "fortune_spins_clan_id_created_at_idx"
  ON "fortune_spins"("clan_id", "created_at");

CREATE INDEX IF NOT EXISTS "fortune_spins_user_id_created_at_idx"
  ON "fortune_spins"("user_id", "created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fortune_spins_user_id_fkey'
  ) THEN
    ALTER TABLE "fortune_spins"
      ADD CONSTRAINT "fortune_spins_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fortune_spins_clan_id_fkey'
  ) THEN
    ALTER TABLE "fortune_spins"
      ADD CONSTRAINT "fortune_spins_clan_id_fkey"
      FOREIGN KEY ("clan_id") REFERENCES "clans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fortune_spins_won_item_id_fkey'
  ) THEN
    ALTER TABLE "fortune_spins"
      ADD CONSTRAINT "fortune_spins_won_item_id_fkey"
      FOREIGN KEY ("won_item_id") REFERENCES "warehouse_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
