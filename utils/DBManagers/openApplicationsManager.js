const { db } = require('../../database.js');

async function updateOpenApplications({ guildDataId, logsMessageId, discordUserId, minecraftName, profileName, hypixelUUID }) {
    try {
        db.prepare(
            `INSERT INTO open_applications (guild_data_id, logs_message_id, discord_user_id, minecraft_name, profile_name, created_at, hypixel_uuid)
            VALUES (?, ?, ?, ?, ?, datetime('now'), ?)
            ON CONFLICT (logs_message_id)
            DO UPDATE SET
                guild_data_id = excluded.guild_data_id,
                discord_user_id = excluded.discord_user_id,
                minecraft_name = excluded.minecraft_name,
                profile_name = excluded.profile_name,
                created_at = datetime('now'),
                hypixel_uuid = excluded.hypixel_uuid`
        ).run(guildDataId, String(logsMessageId), String(discordUserId), minecraftName, profileName ?? null, hypixelUUID ?? null);
    } catch(err) {
        console.error(`DB error in updateOpenApplications: `, err);
        throw err;
    }
}

async function deleteOpenApplication(logsMessageId) {
    try {
        db.prepare(`DELETE FROM open_applications WHERE logs_message_id = ?`).run(String(logsMessageId));
    } catch(err) {
        console.error(`DB error in deleteOpenApplications: attempted to delete logsMessageId=${logsMessageId}: `, err);
        throw err;
    }
}

async function getOpenApplication(logsMessageId) {
    try {
        return db.prepare(`SELECT * FROM open_applications WHERE logs_message_id = ?`).get(String(logsMessageId)) || null;
    } catch(err) {
        console.error(`DB error in getOpenApplication: attempted to fetch logsMessageId=${logsMessageId}: `, err);
        throw err;
    }
}

async function getOpenApplicationFromPlayerName(guildDataId, playerName) {
    try {
        return db.prepare(
            `SELECT * FROM open_applications
            WHERE guild_data_id = ? AND LOWER(minecraft_name) = LOWER(?)`
        ).get(guildDataId, playerName) || null;
    } catch(err) {
        console.error(`DB error in getOpenApplicationFromPlayerName: attempted to fetch playerName=${playerName} in guildDataId=${guildDataId}: `, err);
        throw err;
    }
}

module.exports = { updateOpenApplications, deleteOpenApplication, getOpenApplication, getOpenApplicationFromPlayerName };
