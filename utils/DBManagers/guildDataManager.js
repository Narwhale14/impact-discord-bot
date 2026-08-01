const { pool } = require('../../database.js');

/**
 * Gets the guild_data row for a server, creating it if it doesn't exist yet.
 * Always returns a row, so first-time servers don't get `undefined` back.
 * @param {*} guild interaction.guild
 * @returns the data
 */
async function getGuildData(guild) {
    try {
        const guildId = typeof guild === 'string' ? guild : guild?.id;
        const guildName = typeof guild === 'object' ? guild.name : null;

        const res = await pool.query(
            `SELECT * FROM guild_data WHERE discord_server_id = $1`,
            [guildId]
        );

        if(res.rowCount > 0) return res.rows[0];

        const created = await pool.query(
            `INSERT INTO guild_data (discord_server_id, discord_server_name)
            VALUES ($1, $2)
            ON CONFLICT (discord_server_id) DO UPDATE SET
                discord_server_name = COALESCE(EXCLUDED.discord_server_name, guild_data.discord_server_name)
            RETURNING *`,
            [guildId, guildName]
        );

        return created.rows[0];
    } catch(err) {
        console.error('DB error in getGuildData: ', err);
        throw err;
    }
}

/**
 * sets a single guild_data column
 * @param {*} guild guild id or object (interaction.guild.id)
 * @param {*} columnName name of column in table (must be in allowedColumns below)
 * @param {*} value value to set (pass null to erase)
 */
async function updateGuildColumn(guild, columnName, value) {
    const guildId = typeof guild === 'string' ? guild : guild?.id;
    const guildName = typeof guild === 'object' ? guild.name : null;
    let dbValue = value;

    const allowedColumns = [
        'verification_role',
        'role_mappings',
        'hypixel_guild_id',
        'requests_enabled',
        'logs_channel_id',
        'guild_member_role',
        'application_ping'
    ];

    const jsonColumns = ['role_mappings'];

    // handle JSON automatically for specific columns
    if(jsonColumns.includes(columnName) && value !== null && value !== undefined)
        dbValue = JSON.stringify(value);

    try {
        if(!allowedColumns.includes(columnName)) throw new Error('Invalid column name!');
        if(!guildId) throw new Error('updateGuildColumn called without valid guildId');

        const res = await pool.query(
            `SELECT 1 FROM guild_data WHERE discord_server_id = $1`,
            [guildId]
        );

        // creates guild_data entry if didn't exist
        if(res.rowCount === 0) {
            await pool.query(
                `INSERT INTO guild_data (discord_server_id, discord_server_name, ${columnName})
                VALUES ($1, $2, $3)
                ON CONFLICT (discord_server_id) DO NOTHING`,
                [guildId, guildName, dbValue]
            );
        } else {
            await pool.query(
                `UPDATE guild_data SET ${columnName} = $1 WHERE discord_server_id = $2`,
                [dbValue, guildId]
            )
        }
    } catch(err) {
        console.error('Error updating guild column', err);
        throw err;
    }
}

module.exports = { getGuildData, updateGuildColumn };