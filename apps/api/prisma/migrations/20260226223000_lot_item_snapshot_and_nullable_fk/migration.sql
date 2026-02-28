ALTER TABLE "lots" ADD COLUMN IF NOT EXISTS "item_name" TEXT;
ALTER TABLE "lots" ADD COLUMN IF NOT EXISTS "item_rarity" "ItemRarity";

UPDATE "lots" l
SET
  "item_name" = wi."name",
  "item_rarity" = wi."rarity"
FROM "warehouse_items" wi
WHERE l."warehouse_item_id" = wi."id"
  AND (l."item_name" IS NULL OR l."item_rarity" IS NULL);

ALTER TABLE "lots" ALTER COLUMN "warehouse_item_id" DROP NOT NULL;

DO $$
BEGIN
  ALTER TABLE "lots" DROP CONSTRAINT "lots_warehouse_item_id_fkey";
EXCEPTION
  WHEN undefined_object THEN NULL;
END$$;

ALTER TABLE "lots"
  ADD CONSTRAINT "lots_warehouse_item_id_fkey"
  FOREIGN KEY ("warehouse_item_id") REFERENCES "warehouse_items"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
