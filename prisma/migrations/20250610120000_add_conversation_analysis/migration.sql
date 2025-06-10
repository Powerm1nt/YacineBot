-- AddConversationAnalysisFields

-- Add new fields to conversations table
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "relevance_score" FLOAT DEFAULT 0;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "topic_summary" TEXT;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "is_shared" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "shared_with" TEXT[] DEFAULT '{}'::TEXT[];

-- Add new fields to messages table
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "relevance_score" FLOAT DEFAULT 0;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "has_key_info" BOOLEAN NOT NULL DEFAULT false;
