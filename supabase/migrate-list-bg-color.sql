-- Migrate existing themes with custom list background colors for timer
ALTER TABLE themes 
ADD COLUMN IF NOT EXISTS list_bg_color TEXT NOT NULL DEFAULT 'rgba(103, 58, 183, 0.25)';

-- Optional: Set custom colors for existing themes
-- Uncomment to customize colors per theme:

-- UPDATE themes SET list_bg_color = 'rgba(255, 100, 50, 0.25)' WHERE theme_key = 'neon';
-- UPDATE themes SET list_bg_color = 'rgba(50, 150, 100, 0.25)' WHERE theme_key = 'nature';
-- UPDATE themes SET list_bg_color = 'rgba(100, 100, 100, 0.25)' WHERE theme_key = 'minimal';
-- UPDATE themes SET list_bg_color = 'rgba(247, 224, 224, 0.25)' WHERE theme_key = 'Toje';
-- UPDATE themes SET list_bg_color = 'rgba(39, 140, 180, 0.25)' WHERE theme_key = 'Galaxy';
