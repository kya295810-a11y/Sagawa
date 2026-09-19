BEGIN;

DO $$
BEGIN
  IF to_regclass('news') IS NOT NULL THEN
    ALTER TABLE news
      ADD COLUMN IF NOT EXISTS media_type text,
      ADD COLUMN IF NOT EXISTS image_url text,
      ADD COLUMN IF NOT EXISTS thumbnail_url text;

    UPDATE news
       SET image_url = COALESCE(NULLIF(image_url, ''), NULLIF(image_name, '')),
           thumbnail_url = CASE
             WHEN COALESCE(video_url, '') <> ''
               THEN COALESCE(NULLIF(thumbnail_url, ''), NULLIF(image_name, ''))
             ELSE thumbnail_url
           END,
           media_type = CASE
             WHEN COALESCE(video_url, '') <> '' THEN 'video'
             ELSE 'image'
           END
     WHERE media_type IS NULL OR image_url IS NULL;

    ALTER TABLE news
      ALTER COLUMN media_type SET DEFAULT 'image',
      ALTER COLUMN media_type SET NOT NULL;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conname = 'news_media_type_allowed' AND conrelid = 'news'::regclass
    ) THEN
      ALTER TABLE news
        ADD CONSTRAINT news_media_type_allowed CHECK (media_type IN ('image', 'video'));
    END IF;
  END IF;
END $$;

COMMIT;
