const { db } = require('../../database.js');

async function updateLinkedPlayers({ discordId, hypixelUUID, hypixelName, guildDataId }) {
    try {
        db.prepare(
            `INSERT INTO linked_players (discord_id, hypixel_uuid, hypixel_name, guild_data_id, linked_at)
            VALUES (?, ?, ?, ?, datetime('now'))
            ON CONFLICT (discord_id)
            DO UPDATE SET
                hypixel_uuid = excluded.hypixel_uuid,
                hypixel_name = excluded.hypixel_name,
                guild_data_id = excluded.guild_data_id,
                linked_at = datetime('now')`
        ).run(String(discordId), hypixelUUID, hypixelName, guildDataId);
    } catch(err) {
        console.error(`DB error in updateLinkedPlayers: `, err);
        throw err;
    }
}

async function deleteLinkedPlayer(discordId) {
    try {
        db.prepare(`DELETE FROM linked_players WHERE discord_id = ?`).run(String(discordId));
    } catch(err) {
        console.error(`DB error in deleteLinkedPlayer: attempted to delete discordId=${discordId}: `, err);
        throw err;
    }
}

async function getLinkedPlayer(discordId) {
    try {
        return db.prepare(`SELECT * FROM linked_players WHERE discord_id = ?`).get(String(discordId)) || null;
    } catch(err) {
        console.error(`DB error in getLinkedPlayer: attempted to fetch discordId=${discordId}: `, err);
        throw err;
    }
}

async function countLinkedPlayers(guildDataId) {
    try {
        return db.prepare(`SELECT COUNT(*) c FROM linked_players WHERE guild_data_id = ?`).get(guildDataId).c;
    } catch(err) {
        console.error(`DB error in countLinkedPlayers: attempted to count guildDataId=${guildDataId}: `, err);
        throw err;
    }
}

module.exports = { updateLinkedPlayers, deleteLinkedPlayer, getLinkedPlayer, countLinkedPlayers };
