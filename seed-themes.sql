-- SEED: Migrate data/themes.json to themes table
-- Run in Supabase SQL Editor

DELETE FROM themes WHERE true;

INSERT INTO themes (theme_key, name, emoji, path, color, circle_color) VALUES
('neon', 'Neon Night', '🌃', 'data/themes/neon.png', '#00f2ff', '#ff00ff'),
('nature', 'Nature Forest', '🌿', 'data/themes/nature.png', '#4ade80', '#facc15'),
('minimal', 'Minimalist', '☁️', 'data/themes/minimal.png', '#333333', '#3498db'),
('Toje', 'Toji', '⚔️', 'data/themes/toje.gif', '#333333', '#3498db'),
('Galaxy', 'Galaxy', '🌌', 'data/themes/Galaxy.png', '#333333', '#9700ff');

-- Verify
SELECT * FROM themes;
-- Expected: 5 themes ✅

