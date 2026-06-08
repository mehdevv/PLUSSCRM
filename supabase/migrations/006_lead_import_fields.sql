-- Lead fields for CSV import: wilaya, Google Maps, website

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS wilaya TEXT,
  ADD COLUMN IF NOT EXISTS google_maps_link TEXT,
  ADD COLUMN IF NOT EXISTS website_link TEXT;
