CREATE TABLE IF NOT EXISTS guild_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_server_id TEXT NOT NULL UNIQUE,
    discord_server_name TEXT,
    verification_role TEXT,
    role_mappings TEXT,
    hypixel_guild_id TEXT,
    requests_enabled INTEGER NOT NULL DEFAULT 0,
    logs_channel_id TEXT,
    guild_member_role TEXT,
    application_ping TEXT
);

CREATE TABLE IF NOT EXISTS linked_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_id TEXT NOT NULL,
    hypixel_uuid TEXT NOT NULL,
    hypixel_name TEXT NOT NULL,
    guild_data_id INTEGER NOT NULL REFERENCES guild_data(id) ON DELETE CASCADE,
    linked_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(discord_id, guild_data_id)
);

CREATE TABLE IF NOT EXISTS open_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_data_id INTEGER NOT NULL REFERENCES guild_data(id) ON DELETE CASCADE,
    logs_message_id TEXT UNIQUE,
    discord_user_id TEXT NOT NULL,
    minecraft_name TEXT NOT NULL,
    profile_name TEXT,
    hypixel_uuid TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_open_apps_lookup
    ON open_applications(guild_data_id, LOWER(minecraft_name));

CREATE INDEX IF NOT EXISTS idx_linked_players_guild
    ON linked_players(guild_data_id);
