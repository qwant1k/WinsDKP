-- CreateTable
CREATE TABLE "audit_event_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_id" UUID,
    "actor_name" TEXT,
    "category" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID,
    "entity_name" TEXT,
    "description" TEXT NOT NULL,
    "details" JSONB,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "audit_event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_event_logs_category_created_at_idx" ON "audit_event_logs"("category", "created_at");
CREATE INDEX "audit_event_logs_actor_id_created_at_idx" ON "audit_event_logs"("actor_id", "created_at");
CREATE INDEX "audit_event_logs_entity_type_entity_id_idx" ON "audit_event_logs"("entity_type", "entity_id");
CREATE INDEX "audit_event_logs_created_at_idx" ON "audit_event_logs"("created_at");
