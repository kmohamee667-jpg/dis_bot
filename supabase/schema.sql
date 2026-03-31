-- ============================================================
-- GALAXY BOT - Supabase Schema
-- Run this file in Supabase SQL Editor to set up all tables
-- ============================================================

-- ============================================================
-- DROP & RECREATE (safe to re-run)
-- ============================================================

DROP TABLE IF EXISTS galaxy_users CASCADE;
DROP TABLE IF EXISTS shop_roles CASCADE;
DROP TABLE IF EXISTS shop_metadata CASCADE;
DROP TABLE IF EXISTS themes CASCADE;
DROP TABLE IF EXISTS command_permissions CASCADE;

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE galaxy_users (
    discord_id         TEXT PRIMARY KEY,
    username           TEXT NOT NULL,
    coins              BIGINT NOT NULL DEFAULT 0,
    last_added         TIMESTAMPTZ,
    daily_last_claimed TIMESTAMPTZ,
    study_seconds      BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE shop_roles (
    role_id   TEXT PRIMARY KEY,
    role_name TEXT NOT NULL,
    price     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE shop_metadata (
    key   TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE themes (
    theme_key    TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    emoji        TEXT,
    path         TEXT NOT NULL,
    color        TEXT NOT NULL DEFAULT '#333333',
    circle_color TEXT NOT NULL DEFAULT '#3498db'
);

CREATE TABLE command_permissions (
    id           SERIAL PRIMARY KEY,
    command_name TEXT NOT NULL,
    type         TEXT NOT NULL CHECK (type IN ('role', 'user')),
    value        TEXT NOT NULL,
    UNIQUE (command_name, type, value)
);

-- ============================================================
-- STORED PROCEDURES (atomic operations)
-- ============================================================

CREATE OR REPLACE FUNCTION add_user_coins(
    p_discord_id        TEXT,
    p_username          TEXT,
    p_amount            INTEGER,
    p_update_last_added BOOLEAN DEFAULT FALSE
)
RETURNS void AS $$
BEGIN
    INSERT INTO galaxy_users (discord_id, username, coins, last_added, study_seconds)
    VALUES (
        p_discord_id,
        p_username,
        p_amount,
        CASE WHEN p_update_last_added AND p_amount > 0 THEN NOW() ELSE NULL END,
        0
    )
    ON CONFLICT (discord_id) DO UPDATE
        SET coins      = galaxy_users.coins + p_amount,
            username   = EXCLUDED.username,
            last_added = CASE
                WHEN p_update_last_added AND p_amount > 0 THEN NOW()
                ELSE galaxy_users.last_added
            END;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION add_study_seconds(
    p_discord_id TEXT,
    p_username   TEXT,
    p_seconds    BIGINT
)
RETURNS void AS $$
BEGIN
    INSERT INTO galaxy_users (discord_id, username, study_seconds, coins)
    VALUES (p_discord_id, p_username, p_seconds, 0)
    ON CONFLICT (discord_id) DO UPDATE
        SET study_seconds = galaxy_users.study_seconds + p_seconds,
            username      = EXCLUDED.username;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- SEED DATA — existing users from users.json
-- ============================================================

INSERT INTO galaxy_users (discord_id, username, coins, last_added, daily_last_claimed, study_seconds) VALUES
('1447951012332699871', 'Khaled',            200, NULL, NULL, 0),
('956891840144101466',  '_erllo__.',         200, NULL, NULL, 0),
('1463686469502894234', 'zkz.7',             200, NULL, NULL, 0),
('1021487541322534972', 'ananas__7',         200, NULL, NULL, 0),
('1466515365663346864', 'x99gg',             200, NULL, NULL, 0),
('1441144616492601384', 'الدكتورة',          200, NULL, NULL, 0),
('1438572135114084512', 'الملكه',            200, NULL, NULL, 0),
('1470836367868301352', 'myora11',           200, NULL, NULL, 0),
('1137527007027150848', '4a2m.',             200, NULL, NULL, 0),
('810966863466332210',  '暗いソファ',         200, NULL, NULL, 0),
('1195813561352585239', 'ganaramadan_95963', 200, NULL, NULL, 0),
('1327412006822744087', 'Adam',              200, NULL, NULL, 0),
('452970695618723860',  'imn3',              200, NULL, NULL, 0),
('859440356382343178',  'adham3963',         200, NULL, NULL, 0),
('1200823092629479587', '83pj',              200, NULL, NULL, 0),
('1442593392147169563', 'fatmahany0049',     200, NULL, NULL, 0),
('1436970553071370260', 'rahma.5',           200, NULL, NULL, 0),
('1080596817869275186', '!....',             200, NULL, NULL, 0),
('1308536624392699946', '⚜⚜𝐎m̶ᴀŗ⚜⚜',      200, NULL, NULL, 0),
('1351509422219726848', '7.k7k',             200, NULL, NULL, 0),
('1452937704928186402', 'raneem',            200, NULL, NULL, 0),
('1350207291097350225', 'twinkle04426',      200, NULL, NULL, 0),
('953607486139666453',  'TEKO',              200, NULL, NULL, 0);

-- ============================================================
-- SEED DATA — shop from shop.json
-- ============================================================

INSERT INTO shop_metadata (key, value) VALUES
('shopMessageId', '1487396224729350204'),
('shopChannelId',  '1486834671114391623');

INSERT INTO shop_roles (role_id, role_name, price) VALUES
('1486086853760385105', 'Special',        999),
('1485655235551563867', 'links + photos', 500);

-- ============================================================
-- SEED DATA — themes from themes.json
-- ============================================================

INSERT INTO themes (theme_key, name, emoji, path, color, circle_color) VALUES
('neon',    'Neon Night',    '🌃', 'data/themes/neon.png',    '#00f2ff', '#ff00ff'),
('nature',  'Nature Forest', '🌿', 'data/themes/nature.png',  '#4ade80', '#facc15'),
('minimal', 'Minimalist',    '☁️', 'data/themes/minimal.png', '#333333', '#3498db'),
('Toje',    'Toji',          '⚔️', 'data/themes/toje.gif',    '#333333', '#3498db'),
('Galaxy',  'Galaxy',        '🌌', 'data/themes/Galaxy.png',  '#333333', '#9700ff');

-- ============================================================
-- SEED DATA — admin permissions from config.js
-- ============================================================

INSERT INTO command_permissions (command_name, type, value) VALUES
-- give
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
