-- Remove unused Freemove pipeline feature settings

ALTER TABLE platform_settings
  DROP COLUMN IF EXISTS freemove_rep_ids;
