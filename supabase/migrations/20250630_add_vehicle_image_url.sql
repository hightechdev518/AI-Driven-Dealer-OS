-- Vehicle photo URL + Supabase Storage bucket for uploads
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS image_url TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('vehicle-images', 'vehicle-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read vehicle images"
ON storage.objects FOR SELECT
USING (bucket_id = 'vehicle-images');

CREATE POLICY "Allow upload vehicle images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'vehicle-images');

CREATE POLICY "Allow update vehicle images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'vehicle-images');

CREATE POLICY "Allow delete vehicle images"
ON storage.objects FOR DELETE
USING (bucket_id = 'vehicle-images');
