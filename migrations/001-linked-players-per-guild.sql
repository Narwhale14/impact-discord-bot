CREATE TABLE linked_players_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_id TEXT NOT NULL,
    hypixel_uuid TEXT NOT NULL,
    hypixel_name TEXT NOT NULL,
    guild_data_id INTEGER NOT NULL REFERENCES guild_data(id) ON DELETE CASCADE,
    linked_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(discord_id, guild_data_id)
);

INSERT INTO linked_players_new (id, discord_id, hypixel_uuid, hypixel_name, guild_data_id, linked_at)
SELECT id, discord_id, hypixel_uuid, hypixel_name, guild_data_id, linked_at FROM linked_players;

DROP TABLE linked_players;

ALTER TABLE linked_players_new RENAME TO linked_players;

CREATE INDEX IF NOT EXISTS idx_linked_players_guild ON linked_players(guild_data_id);
