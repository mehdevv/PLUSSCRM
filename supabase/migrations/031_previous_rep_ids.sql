-- Sales reps allowed to use pipeline Previous (step back one stage)

ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS previous_rep_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
