-- ============================================================
-- GALAXY BOT - SAFE SCHEMA (RE-RUN FRIENDLY)
-- ============================================================

-- ============================================================
-- TABLES (SAFE CREATE)
-- ============================================================

CREATE TABLE IF NOT EXISTS galaxy_users (
    discord_id         TEXT PRIMARY KEY,
    username           TEXT NOT NULL,
    coins              BIGINT NOT NULL DEFAULT 0,
    last_added         TIMESTAMPTZ,
    daily_last_claimed TIMESTAMPTZ,
    study_seconds      BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS shop_roles (
    role_id   TEXT PRIMARY KEY,
    role_name TEXT NOT NULL,
    price     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS shop_metadata (
    key   TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS themes (
    theme_key    TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    emoji        TEXT,
    path         TEXT NOT NULL,
    color        TEXT NOT NULL DEFAULT '#333333',
    circle_color TEXT NOT NULL DEFAULT '#3498db'
);

CREATE TABLE IF NOT EXISTS command_permissions (
    id           SERIAL PRIMARY KEY,
    command_name TEXT NOT NULL,
    type         TEXT NOT NULL CHECK (type IN ('role', 'user')),
    value        TEXT NOT NULL,
    UNIQUE (command_name, type, value)
);

CREATE TABLE IF NOT EXISTS timer (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL UNIQUE,
    starter_id TEXT NOT NULL,
    starter_name TEXT,
    
    study_time INT NOT NULL,
    break_time INT NOT NULL,
    cycles INT NOT NULL,
    current_cycle INT DEFAULT 1,
    
    theme_key VARCHAR(50),
    mode VARCHAR(50),
    update_mode VARCHAR(50),
    
    start_time BIGINT NOT NULL,
    paused_time BIGINT,
    
    status VARCHAR(20) NOT NULL DEFAULT 'running',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STORED PROCEDURES (SAFE)
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
-- SAFE SEED EXAMPLES (اختياري)
-- ============================================================

-- مثال: إضافة بيانات بدون تكرار
-- INSERT INTO shop_metadata (key, value)
-- VALUES ('shopMessageId', '123')
-- ON CONFLICT (key) DO NOTHING;

-- مثال: تحديث لو موجود
-- INSERT INTO shop_roles (role_id, role_name, price)
-- VALUES ('1', 'VIP', 500)
-- ON CONFLICT (role_id) DO UPDATE
-- SET role_name = EXCLUDED.role_name,
--     price = EXCLUDED.price;