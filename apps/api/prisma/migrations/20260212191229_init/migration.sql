-- CreateEnum
CREATE TYPE "GlobalRole" AS ENUM ('PORTAL_ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "ClanRole" AS ENUM ('CLAN_LEADER', 'ELDER', 'MEMBER', 'NEWBIE');

-- CreateEnum
CREATE TYPE "ClanJoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DkpTransactionType" AS ENUM ('ACTIVITY_REWARD', 'AUCTION_WIN', 'AUCTION_REFUND', 'PENALTY', 'ADMIN_ADJUST', 'HOLD_PLACE', 'HOLD_RELEASE', 'HOLD_FINALIZE', 'MANUAL_CREDIT', 'MANUAL_DEBIT');

-- CreateEnum
CREATE TYPE "DkpHoldStatus" AS ENUM ('ACTIVE', 'FINALIZED', 'RELEASED');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('DRAFT', 'OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('RAID', 'EXPEDITION', 'DUNGEON', 'PVP', 'GUILD_WAR', 'WORLD_BOSS', 'OTHER');

-- CreateEnum
CREATE TYPE "AuctionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LotStatus" AS ENUM ('PENDING', 'ACTIVE', 'SOLD', 'UNSOLD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RandomizerStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ItemRarity" AS ENUM ('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC');

-- CreateEnum
CREATE TYPE "WarehouseMovementType" AS ENUM ('INCOMING', 'OUTGOING_AUCTION', 'OUTGOING_RANDOMIZER', 'RETURN', 'WRITE_OFF');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('DKP_RECEIVED', 'DKP_PENALTY', 'AUCTION_OUTBID', 'AUCTION_WON', 'AUCTION_LOST', 'AUCTION_STARTED', 'RANDOMIZER_WON', 'RANDOMIZER_STARTED', 'ACTIVITY_CREATED', 'ACTIVITY_STARTED', 'ACTIVITY_COMPLETED', 'CLAN_JOIN_REQUEST', 'CLAN_JOIN_APPROVED', 'CLAN_JOIN_REJECTED', 'CLAN_ROLE_CHANGED', 'CLAN_KICKED', 'NEWS_POSTED', 'COMMENT_REPLY', 'SYSTEM');

-- CreateEnum
CREATE TYPE "MediaEntityType" AS ENUM ('NEWS_POST', 'FEED_POST', 'COMMENT', 'WAREHOUSE_ITEM', 'USER_AVATAR');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "global_role" "GlobalRole" NOT NULL DEFAULT 'USER',
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "email_token" TEXT,
    "reset_token" TEXT,
    "reset_token_exp" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "nickname" TEXT NOT NULL,
    "display_name" TEXT,
    "bm" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "avatar_url" TEXT,
    "contacts" JSONB DEFAULT '{}',
    "locale" TEXT NOT NULL DEFAULT 'ru',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Almaty',
    "notify_prefs" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "email" TEXT,
    "avatar" TEXT,
    "raw" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clans" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "description" TEXT,
    "avatar_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clan_memberships" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "clan_id" UUID NOT NULL,
    "role" "ClanRole" NOT NULL DEFAULT 'NEWBIE',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clan_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clan_join_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "clan_id" UUID NOT NULL,
    "status" "ClanJoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clan_join_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dkp_wallets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "on_hold" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_earned" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dkp_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dkp_transactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "DkpTransactionType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "balance_before" DECIMAL(12,2) NOT NULL,
    "balance_after" DECIMAL(12,2) NOT NULL,
    "description" TEXT,
    "reference_type" TEXT,
    "reference_id" UUID,
    "idempotency_key" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dkp_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dkp_holds" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "DkpHoldStatus" NOT NULL DEFAULT 'ACTIVE',
    "reason" TEXT,
    "reference_type" TEXT,
    "reference_id" UUID,
    "finalized_at" TIMESTAMP(3),
    "released_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dkp_holds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "penalties" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "issued_by" UUID NOT NULL,
    "clan_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "penalties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" UUID NOT NULL,
    "clan_id" UUID NOT NULL,
    "type" "ActivityType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "base_dkp" DECIMAL(12,2) NOT NULL,
    "start_at" TIMESTAMP(3),
    "end_at" TIMESTAMP(3),
    "status" "ActivityStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by" UUID NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_participants" (
    "id" UUID NOT NULL,
    "activity_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "dkp_earned" DECIMAL(12,2),
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" UUID NOT NULL,
    "activity_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coefficient_power_ranges" (
    "id" UUID NOT NULL,
    "clan_id" UUID NOT NULL,
    "from_power" INTEGER NOT NULL,
    "to_power" INTEGER NOT NULL,
    "coefficient" DECIMAL(5,3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coefficient_power_ranges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coefficient_level_ranges" (
    "id" UUID NOT NULL,
    "clan_id" UUID NOT NULL,
    "from_level" INTEGER NOT NULL,
    "to_level" INTEGER NOT NULL,
    "coefficient" DECIMAL(5,3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coefficient_level_ranges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_items" (
    "id" UUID NOT NULL,
    "clan_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "rarity" "ItemRarity" NOT NULL DEFAULT 'COMMON',
    "image_url" TEXT,
    "dkp_price" DECIMAL(12,2),
    "source" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_item_movements" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "type" "WarehouseMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT,
    "performed_by" UUID NOT NULL,
    "reference_type" TEXT,
    "reference_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warehouse_item_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auctions" (
    "id" UUID NOT NULL,
    "clan_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "AuctionStatus" NOT NULL DEFAULT 'DRAFT',
    "start_at" TIMESTAMP(3),
    "end_at" TIMESTAMP(3),
    "anti_sniper_enabled" BOOLEAN NOT NULL DEFAULT true,
    "anti_sniper_seconds" INTEGER NOT NULL DEFAULT 20,
    "anti_sniper_extend_sec" INTEGER NOT NULL DEFAULT 30,
    "created_by" UUID NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auctions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lots" (
    "id" UUID NOT NULL,
    "auction_id" UUID NOT NULL,
    "warehouse_item_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "start_price" DECIMAL(12,2) NOT NULL,
    "min_step" DECIMAL(12,2) NOT NULL DEFAULT 1,
    "current_price" DECIMAL(12,2),
    "status" "LotStatus" NOT NULL DEFAULT 'PENDING',
    "ends_at" TIMESTAMP(3),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "winner_id" UUID,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auction_participants" (
    "id" UUID NOT NULL,
    "auction_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auction_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bids" (
    "id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "is_auto_bid" BOOLEAN NOT NULL DEFAULT false,
    "max_auto_bid" DECIMAL(12,2),
    "hold_id" UUID,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lot_results" (
    "id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "winner_id" UUID,
    "final_price" DECIMAL(12,2),
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lot_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auction_chat_messages" (
    "id" UUID NOT NULL,
    "auction_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auction_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auction_system_events" (
    "id" UUID NOT NULL,
    "auction_id" UUID NOT NULL,
    "event" TEXT NOT NULL,
    "data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auction_system_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "randomizer_sessions" (
    "id" UUID NOT NULL,
    "clan_id" UUID NOT NULL,
    "warehouse_item_id" UUID NOT NULL,
    "status" "RandomizerStatus" NOT NULL DEFAULT 'PENDING',
    "seed" TEXT NOT NULL,
    "seed_hash" TEXT NOT NULL,
    "algorithm_version" TEXT NOT NULL DEFAULT 'v1',
    "input_data" JSONB NOT NULL,
    "created_by" UUID NOT NULL,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "randomizer_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "randomizer_entries" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "weight" DECIMAL(8,5) NOT NULL,
    "bonus" DECIMAL(8,5) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "randomizer_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "randomizer_results" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "winner_id" UUID NOT NULL,
    "roll_value" DECIMAL(12,8) NOT NULL,
    "proof" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "randomizer_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_posts" (
    "id" UUID NOT NULL,
    "clan_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feed_posts" (
    "id" UUID NOT NULL,
    "clan_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "is_reported" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feed_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "news_post_id" UUID,
    "feed_post_id" UUID,
    "parent_id" UUID,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "emoji" TEXT NOT NULL,
    "news_post_id" UUID,
    "feed_post_id" UUID,
    "comment_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "data" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "user_agent" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_attachments" (
    "id" UUID NOT NULL,
    "uploader_id" UUID NOT NULL,
    "entity_type" "MediaEntityType" NOT NULL,
    "entity_id" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "group" TEXT NOT NULL DEFAULT 'general',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_user_id_key" ON "profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_nickname_key" ON "profiles"("nickname");

-- CreateIndex
CREATE UNIQUE INDEX "social_accounts_provider_provider_id_key" ON "social_accounts"("provider", "provider_id");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_refresh_token_idx" ON "sessions"("refresh_token");

-- CreateIndex
CREATE UNIQUE INDEX "clans_name_key" ON "clans"("name");

-- CreateIndex
CREATE UNIQUE INDEX "clans_tag_key" ON "clans"("tag");

-- CreateIndex
CREATE INDEX "clan_memberships_clan_id_idx" ON "clan_memberships"("clan_id");

-- CreateIndex
CREATE UNIQUE INDEX "clan_memberships_user_id_clan_id_key" ON "clan_memberships"("user_id", "clan_id");

-- CreateIndex
CREATE INDEX "clan_join_requests_clan_id_status_idx" ON "clan_join_requests"("clan_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "dkp_wallets_user_id_key" ON "dkp_wallets"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "dkp_transactions_idempotency_key_key" ON "dkp_transactions"("idempotency_key");

-- CreateIndex
CREATE INDEX "dkp_transactions_user_id_created_at_idx" ON "dkp_transactions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "dkp_transactions_reference_type_reference_id_idx" ON "dkp_transactions"("reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "dkp_holds_user_id_status_idx" ON "dkp_holds"("user_id", "status");

-- CreateIndex
CREATE INDEX "penalties_user_id_idx" ON "penalties"("user_id");

-- CreateIndex
CREATE INDEX "activities_clan_id_status_idx" ON "activities"("clan_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "activity_participants_activity_id_user_id_key" ON "activity_participants"("activity_id", "user_id");

-- CreateIndex
CREATE INDEX "coefficient_power_ranges_clan_id_idx" ON "coefficient_power_ranges"("clan_id");

-- CreateIndex
CREATE INDEX "coefficient_level_ranges_clan_id_idx" ON "coefficient_level_ranges"("clan_id");

-- CreateIndex
CREATE INDEX "warehouse_items_clan_id_idx" ON "warehouse_items"("clan_id");

-- CreateIndex
CREATE INDEX "warehouse_item_movements_item_id_idx" ON "warehouse_item_movements"("item_id");

-- CreateIndex
CREATE INDEX "auctions_clan_id_status_idx" ON "auctions"("clan_id", "status");

-- CreateIndex
CREATE INDEX "lots_auction_id_status_idx" ON "lots"("auction_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "auction_participants_auction_id_user_id_key" ON "auction_participants"("auction_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "bids_idempotency_key_key" ON "bids"("idempotency_key");

-- CreateIndex
CREATE INDEX "bids_lot_id_created_at_idx" ON "bids"("lot_id", "created_at");

-- CreateIndex
CREATE INDEX "bids_user_id_idx" ON "bids"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "lot_results_lot_id_key" ON "lot_results"("lot_id");

-- CreateIndex
CREATE INDEX "auction_chat_messages_auction_id_created_at_idx" ON "auction_chat_messages"("auction_id", "created_at");

-- CreateIndex
CREATE INDEX "auction_system_events_auction_id_created_at_idx" ON "auction_system_events"("auction_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "randomizer_sessions_idempotency_key_key" ON "randomizer_sessions"("idempotency_key");

-- CreateIndex
CREATE INDEX "randomizer_sessions_clan_id_idx" ON "randomizer_sessions"("clan_id");

-- CreateIndex
CREATE UNIQUE INDEX "randomizer_entries_session_id_user_id_key" ON "randomizer_entries"("session_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "randomizer_results_session_id_key" ON "randomizer_results"("session_id");

-- CreateIndex
CREATE INDEX "news_posts_clan_id_created_at_idx" ON "news_posts"("clan_id", "created_at");

-- CreateIndex
CREATE INDEX "feed_posts_clan_id_created_at_idx" ON "feed_posts"("clan_id", "created_at");

-- CreateIndex
CREATE INDEX "comments_news_post_id_idx" ON "comments"("news_post_id");

-- CreateIndex
CREATE INDEX "comments_feed_post_id_idx" ON "comments"("feed_post_id");

-- CreateIndex
CREATE UNIQUE INDEX "reactions_user_id_news_post_id_emoji_key" ON "reactions"("user_id", "news_post_id", "emoji");

-- CreateIndex
CREATE UNIQUE INDEX "reactions_user_id_feed_post_id_emoji_key" ON "reactions"("user_id", "feed_post_id", "emoji");

-- CreateIndex
CREATE UNIQUE INDEX "reactions_user_id_comment_id_emoji_key" ON "reactions"("user_id", "comment_id", "emoji");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_created_at_idx" ON "notifications"("user_id", "is_read", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "media_attachments_entity_type_entity_id_idx" ON "media_attachments"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clan_memberships" ADD CONSTRAINT "clan_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clan_memberships" ADD CONSTRAINT "clan_memberships_clan_id_fkey" FOREIGN KEY ("clan_id") REFERENCES "clans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clan_join_requests" ADD CONSTRAINT "clan_join_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clan_join_requests" ADD CONSTRAINT "clan_join_requests_clan_id_fkey" FOREIGN KEY ("clan_id") REFERENCES "clans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dkp_wallets" ADD CONSTRAINT "dkp_wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dkp_transactions" ADD CONSTRAINT "dkp_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dkp_holds" ADD CONSTRAINT "dkp_holds_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalties" ADD CONSTRAINT "penalties_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_clan_id_fkey" FOREIGN KEY ("clan_id") REFERENCES "clans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_participants" ADD CONSTRAINT "activity_participants_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_participants" ADD CONSTRAINT "activity_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_items" ADD CONSTRAINT "warehouse_items_clan_id_fkey" FOREIGN KEY ("clan_id") REFERENCES "clans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_item_movements" ADD CONSTRAINT "warehouse_item_movements_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "warehouse_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_clan_id_fkey" FOREIGN KEY ("clan_id") REFERENCES "clans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "auctions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_warehouse_item_id_fkey" FOREIGN KEY ("warehouse_item_id") REFERENCES "warehouse_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_participants" ADD CONSTRAINT "auction_participants_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "auctions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_participants" ADD CONSTRAINT "auction_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bids" ADD CONSTRAINT "bids_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bids" ADD CONSTRAINT "bids_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_results" ADD CONSTRAINT "lot_results_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_chat_messages" ADD CONSTRAINT "auction_chat_messages_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "auctions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_chat_messages" ADD CONSTRAINT "auction_chat_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_system_events" ADD CONSTRAINT "auction_system_events_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "auctions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "randomizer_sessions" ADD CONSTRAINT "randomizer_sessions_clan_id_fkey" FOREIGN KEY ("clan_id") REFERENCES "clans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "randomizer_entries" ADD CONSTRAINT "randomizer_entries_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "randomizer_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "randomizer_entries" ADD CONSTRAINT "randomizer_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "randomizer_results" ADD CONSTRAINT "randomizer_results_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "randomizer_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_posts" ADD CONSTRAINT "news_posts_clan_id_fkey" FOREIGN KEY ("clan_id") REFERENCES "clans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_posts" ADD CONSTRAINT "news_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_posts" ADD CONSTRAINT "feed_posts_clan_id_fkey" FOREIGN KEY ("clan_id") REFERENCES "clans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_posts" ADD CONSTRAINT "feed_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_news_post_id_fkey" FOREIGN KEY ("news_post_id") REFERENCES "news_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_feed_post_id_fkey" FOREIGN KEY ("feed_post_id") REFERENCES "feed_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_news_post_id_fkey" FOREIGN KEY ("news_post_id") REFERENCES "news_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_feed_post_id_fkey" FOREIGN KEY ("feed_post_id") REFERENCES "feed_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_attachments" ADD CONSTRAINT "media_attachments_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
