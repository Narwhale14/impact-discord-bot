const { pool } = require('../../database.js');

async function updateOpenApplications({ guildDataId, logsMessageId, discordUserId, minecraftName, profileName, hypixelUUID }) {
    try {
        await pool.query(
            `INSERT INTO open_applications (guild_data_id, logs_message_id, discord_user_id, minecraft_name, profile_name, created_at, hypixel_uuid)
            VALUES ($1, $2, $3, $4, $5, NOW(), $6)
            ON CONFLICT (logs_message_id)
            DO UPDATE SET
                guild_data_id = EXCLUDED.guild_data_id,
                discord_user_id = EXCLUDED.discord_user_id,
                minecraft_name = EXCLUDED.minecraft_name,
                profile_name = EXCLUDED.profile_name,
                created_at = NOW(),
                hypixel_uuid = EXCLUDED.hypixel_uuid`,
            [guildDataId, logsMessageId, discordUserId, minecraftName, profileName, hypixelUUID]
        );
    } catch(err) {
        console.error(`DB error in updateOpenApplications: `, err);
        throw err;
    }
}

async function deleteOpenApplication(logsMessageId) {
    try {
        await pool.query(
            `DELETE FROM open_applications WHERE logs_message_id = $1`, 
            [logsMessageId]
        );
    } catch(err) {
        console.error(`DB error in deleteOpenApplications: attempted to delete logsMessageId=${logsMessageId}: `, err);
        throw err;
    }
}

async function getOpenApplication(logsMessageId) {
    try {
        const res = await pool.query(
            `SELECT * FROM open_applications WHERE logs_message_id = $1`,
            [logsMessageId]
        );

        return res.rows[0] || null;
    } catch(err) {
        console.error(`DB error in getOpenApplication: attempted to fetch logsMessageId=${logsMessageId}: `, err);
        throw err;
    }
}

async function getOpenApplicationFromPlayerName(guildDataId, playerName) {
    try {
        const res = await pool.query(
            `SELECT * FROM open_applications
            WHERE guild_data_id = $1 AND LOWER(minecraft_name) = LOWER($2)`,
            [guildDataId, playerName]
        );

        return res.rows[0] || null;
    } catch(err) {
        console.error(`DB error in getOpenApplicationFromPlayerName: attempted to fetch playerName=${playerName} in guildDataId=${guildDataId}: `, err);
        throw err;
    }
}

module.exports = { updateOpenApplications, deleteOpenApplication, getOpenApplication, getOpenApplicationFromPlayerName };