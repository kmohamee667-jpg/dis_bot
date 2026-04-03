-- SEED: Migrate ALL config.js PERMISSIONS to command_permissions table
-- Run this ONCE in Supabase SQL Editor (https://supabase.com/dashboard)
-- Then restart bot

DELETE FROM command_permissions WHERE true;  -- Clear existing data

-- give
INSERT INTO command_permissions (command_name, type, value) VALUES
('give', 'role', 'معلم'),
('give', 'role', 'معلمه'),
('give', 'user', 'adham3963'),
('give', 'user', 'x99gg'),
('give', 'user', 'khal3d0047'),
('give', 'user', '_erllo__.'),

-- rm-coins
('rm-coins', 'user', 'adham3963'),
('rm-coins', 'user', 'x99gg'),
('rm-coins', 'user', 'khal3d0047'),
('rm-coins', 'user', '_erllo__.'),

-- coins
('coins', 'role', 'معلم'),
('coins', 'role', 'معلمه'),
('coins', 'user', 'adham3963'),
('coins', 'user', 'x99gg'),
('coins', 'user', 'khal3d0047'),
('coins', 'user', '_erllo__.'),

-- add-role
('add-role', 'user', 'adham3963'),
('add-role', 'user', 'x99gg'),
('add-role', 'user', 'khal3d0047'),
('add-role', 'user', '_erllo__.'),

-- delete-role
('delete-role', 'user', 'adham3963'),
('delete-role', 'user', 'x99gg'),
('delete-role', 'user', 'khal3d0047'),
('delete-role', 'user', '_erllo__.'),

-- edit-price
('edit-price', 'user', 'adham3963'),
('edit-price', 'user', 'x99gg'),
('edit-price', 'user', 'khal3d0047'),
('edit-price', 'user', '_erllo__.'),

-- shop-setup
('shop-setup', 'user', 'adham3963'),
('shop-setup', 'user', 'x99gg'),
('shop-setup', 'user', 'khal3d0047'),
('shop-setup', 'user', '_erllo__.'),

-- timer-stop
('timer-stop', 'role', 'OWNER'),
('timer-stop', 'user', 'adham3963'),
('timer-stop', 'user', 'x99gg'),
('timer-stop', 'user', 'khal3d0047'),
('timer-stop', 'user', '_erllo__.'),

-- challenge
('challenge', 'role', 'معلم'),
('challenge', 'role', 'معلمه'),
('challenge', 'role', 'OWNER'),
('challenge', 'user', 'adham3963'),
('challenge', 'user', 'x99gg'),
('challenge', 'user', 'khal3d0047'),
('challenge', 'user', '_erllo__.'),

-- challenge-continue
('challenge-continue', 'role', 'معلم'),
('challenge-continue', 'role', 'معلمه'),
('challenge-continue', 'role', 'OWNER'),
('challenge-continue', 'user', 'adham3963'),
('challenge-continue', 'user', 'x99gg'),
('challenge-continue', 'user', 'khal3d0047'),
('challenge-continue', 'user', '_erllo__.'),

-- top-time
('top-time', 'role', 'everyone'),
('top-time', 'user', 'adham3963'),
('top-time', 'user', 'x99gg'),
('top-time', 'user', 'khal3d0047'),
('top-time', 'user', '_erllo__.'),

-- مسح
('مسح', 'role', 'Admin'),
('مسح', 'role', 'dev'),
('مسح', 'role', 'bots'),
('مسح', 'role', 'OWNER'),
('مسح', 'role', 'Mod'),
('مسح', 'role', 'head admin'),
('مسح', 'role', 'trial mod'),
('مسح', 'role', 'staff support'),
('مسح', 'role', 'معلم'),
('مسح', 'role', 'معلمه'),
('مسح', 'user', 'adham3963'),
('مسح', 'user', 'khal3d0047'),
('مسح', 'user', '_erllo__.'); 

-- Verify: SELECT command_name, COUNT(*) FROM command_permissions GROUP BY command_name;
-- Expected: 11 commands migrated ✅

-- After running: Restart bot → Check console: "✅ Loaded permissions for 11 commands from Supabase."

