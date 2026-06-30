-- Multiple vehicle photos (gallery)
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS image_urls JSONB DEFAULT '[]'::jsonb;

UPDATE vehicles
SET image_urls = jsonb_build_array(image_url)
WHERE image_url IS NOT NULL
  AND (image_urls IS NULL OR image_urls = '[]'::jsonb);
