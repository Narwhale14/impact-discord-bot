const { db } = require('../../database.js');

async function updateLinkedPlayers({ discordId, hypixelUUID, hypixelName, guildDataId }) {
    try {
        db.prepare(
            `INSERT INTO linked_players (discord_id, hypixel_uuid, hypixel_name, guild_data_id, linked_at)
            VALUES (?, ?, ?, ?, datetime('now'))
            ON CONFLICT (discord_id, guild_data_id)
            DO UPDATE SET
                hypixel_uuid = excluded.hypixel_uuid,
                hypixel_name = excluded.hypixel_name,
                linked_at = datetime('now')`
        ).run(String(discordId), hypixelUUID, hypixelName, guildDataId);
    } catch(err) {
        console.error(`DB error in updateLinkedPlayers: `, err);
        throw err;
    }
}

async function deleteLinkedPlayer(discordId, guildDataId) {
    try {
        db.prepare(`DELETE FROM linked_players WHERE discord_id = ? AND guild_data_id = ?`).run(String(discordId), guildDataId);
    } catch(err) {
        console.error(`DB error in deleteLinkedPlayer: attempted to delete discordId=${discordId} in guildDataId=${guildDataId}: `, err);
        throw err;
    }
}

async function getLinkedPlayer(discordId, guildDataId) {
    try {
        return db.prepare(`SELECT * FROM linked_players WHERE discord_id = ? AND guild_data_id = ?`).get(String(discordId), guildDataId) || null;
    } catch(err) {
        console.error(`DB error in getLinkedPlayer: attempted to fetch discordId=${discordId} in guildDataId=${guildDataId}: `, err);
        throw err;
    }
}

async function getAllLinkedPlayers(guildDataId) {
    try {
        return db.prepare(`SELECT * FROM linked_players WHERE guild_data_id = ?`).all(guildDataId);
    } catch(err) {
        console.error(`DB error in getAllLinkedPlayers: attempted to fetch guildDataId=${guildDataId}: `, err);
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

module.exports = { updateLinkedPlayers, deleteLinkedPlayer, getLinkedPlayer, countLinkedPlayers, getAllLinkedPlayers };
