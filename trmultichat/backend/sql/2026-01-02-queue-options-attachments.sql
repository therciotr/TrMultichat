-- QueueOptions attachments (Filas & Chatbot)
-- Apply:
--   ALTER TABLE ONLY "QueueOptions" ... (uses IF NOT EXISTS; safe to run multiple times)
--
-- Rollback (simple):
--   ALTER TABLE "QueueOptions" DROP COLUMN IF EXISTS "attachmentPath", ...;

ALTER TABLE "QueueOptions"
  ADD COLUMN IF NOT EXISTS "attachmentPath" text,
  ADD COLUMN IF NOT EXISTS "attachmentName" text,
  ADD COLUMN IF NOT EXISTS "attachmentMime" text,
  ADD COLUMN IF NOT EXISTS "attachmentSize" integer;


