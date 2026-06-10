-- Sales reps allowed to use pipeline Freemove (drag / jump to any stage)

ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS freemove_rep_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
