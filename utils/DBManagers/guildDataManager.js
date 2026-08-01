const { db } = require('../../database.js');

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
const booleanColumns = ['requests_enabled'];

function hydrate(row) {
    if(!row) return null;

    return {
        ...row,
        role_mappings: row.role_mappings ? JSON.parse(row.role_mappings) : null,
        requests_enabled: Boolean(row.requests_enabled)
    };
}

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

        const existing = db.prepare(`SELECT * FROM guild_data WHERE discord_server_id = ?`).get(guildId);
        if(existing) return hydrate(existing);

        db.prepare(
            `INSERT INTO guild_data (discord_server_id, discord_server_name)
            VALUES (?, ?)
            ON CONFLICT (discord_server_id) DO NOTHING`
        ).run(guildId, guildName);

        return hydrate(db.prepare(`SELECT * FROM guild_data WHERE discord_server_id = ?`).get(guildId));
    } catch(err) {
        console.error('DB error in getGuildData: ', err);
        throw err;
    }
}

/**
 * sets a single guild_data column
 * @param {*} guild guild id or object (interaction.guild.id)
 * @param {*} columnName name of column in table (must be in allowedColumns above)
 * @param {*} value value to set (pass null to erase)
 */
async function updateGuildColumn(guild, columnName, value) {
    const guildId = typeof guild === 'string' ? guild : guild?.id;
    const guildName = typeof guild === 'object' ? guild.name : null;
    let dbValue = value ?? null;

    if(dbValue !== null && jsonColumns.includes(columnName)) dbValue = JSON.stringify(dbValue);
    if(dbValue !== null && booleanColumns.includes(columnName)) dbValue = Number(Boolean(dbValue));

    try {
        if(!allowedColumns.includes(columnName)) throw new Error('Invalid column name!');
        if(!guildId) throw new Error('updateGuildColumn called without valid guildId');

        const exists = db.prepare(`SELECT 1 FROM guild_data WHERE discord_server_id = ?`).get(guildId);

        if(!exists) {
            db.prepare(
                `INSERT INTO guild_data (discord_server_id, discord_server_name, ${columnName})
                VALUES (?, ?, ?)
                ON CONFLICT (discord_server_id) DO NOTHING`
            ).run(guildId, guildName, dbValue);
        } else {
            db.prepare(`UPDATE guild_data SET ${columnName} = ? WHERE discord_server_id = ?`).run(dbValue, guildId);
        }
    } catch(err) {
        console.error('Error updating guild column', err);
        throw err;
    }
}

module.exports = { getGuildData, updateGuildColumn };
