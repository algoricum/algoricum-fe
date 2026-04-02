-- Add follow_up_name column for reliable follow-up deduplication
-- Replaces fragile text pattern matching (ilike) with exact column match

-- Step 1: Add the column
ALTER TABLE conversation
ADD COLUMN IF NOT EXISTS follow_up_name text;

-- Step 2: Add a unique partial index to prevent race condition duplicates
-- Only one follow-up of each type per thread
CREATE UNIQUE INDEX IF NOT EXISTS uq_conversation_thread_follow_up
ON conversation (thread_id, follow_up_name)
WHERE follow_up_name IS NOT NULL;

-- Step 3: Add a regular index for fast lookups
CREATE INDEX IF NOT EXISTS idx_conversation_follow_up_name
ON conversation (thread_id, follow_up_name)
WHERE follow_up_name IS NOT NULL;

-- Step 4: Backfill existing rows by extracting the rule name from the message prefix
-- Messages are stored as "RULE_NAME: message content" or "RULE_NAME EMAIL - Subject: ..."
UPDATE conversation
SET follow_up_name = LOWER(
  CASE
    WHEN message LIKE '% EMAIL - Subject:%'
      THEN TRIM(SPLIT_PART(message, ' EMAIL - Subject:', 1))
    WHEN message LIKE '%:%'
      THEN TRIM(SPLIT_PART(message, ':', 1))
    ELSE NULL
  END
)
WHERE sender_type = 'assistant'
  AND is_from_user = false
  AND follow_up_name IS NULL
  AND (
    message ILIKE 'SMS_%:%'
    OR message ILIKE 'EMAIL_%:%'
    OR message ILIKE '% EMAIL - Subject:%'
  );
