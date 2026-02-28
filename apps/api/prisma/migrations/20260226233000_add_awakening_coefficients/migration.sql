ALTER TABLE "profiles"
  ADD COLUMN IF NOT EXISTS "awakening_level" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_awakening_level_check'
  ) THEN
    ALTER TABLE "profiles"
      ADD CONSTRAINT "profiles_awakening_level_check"
      CHECK ("awakening_level" IS NULL OR ("awakening_level" BETWEEN 1 AND 3));
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS "coefficient_awakening_ranges" (
  "id" UUID NOT NULL,
  "clan_id" UUID NOT NULL,
  "from_awakening" INTEGER NOT NULL,
  "to_awakening" INTEGER NOT NULL,
  "coefficient" DECIMAL(5,3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "coefficient_awakening_ranges_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "coefficient_awakening_ranges_clan_id_idx"
  ON "coefficient_awakening_ranges"("clan_id");
