const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const { db } = require('../database.js');

const force = process.argv.includes('--force');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000
});

const text = v => v === null || v === undefined ? null : String(v);
const int = v => v === null || v === undefined ? null : Number(v);
const bool = v => v === null || v === undefined ? 0 : Number(Boolean(v));
const json = v => v === null || v === undefined ? null : (typeof v === 'string' ? v : JSON.stringify(v));
const time = v => v === null || v === undefined ? null : new Date(v).toISOString().slice(0, 19).replace('T', ' ');

async function main() {
    if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set - nothing to migrate from.');

    const counts = {
        guild_data: db.prepare('SELECT COUNT(*) c FROM guild_data').get().c,
        linked_players: db.prepare('SELECT COUNT(*) c FROM linked_players').get().c,
        open_applications: db.prepare('SELECT COUNT(*) c FROM open_applications').get().c
    };
    const total = counts.guild_data + counts.linked_players + counts.open_applications;

    if(total > 0 && !force) {
        console.error(`Target database already holds ${total} rows:`, counts);
        console.error('Refusing to run. Delete the file and retry, or pass --force to wipe and reimport.');
        process.exit(1);
    }

    console.log('Reading from Neon...');
    const guilds = (await pool.query('SELECT * FROM guild_data ORDER BY id')).rows;
    const players = (await pool.query('SELECT * FROM linked_players ORDER BY id')).rows;
    const apps = (await pool.query('SELECT * FROM open_applications ORDER BY id')).rows;
    console.log(`  guild_data=${guilds.length} linked_players=${players.length} open_applications=${apps.length}`);

    const insertGuild = db.prepare(
        `INSERT INTO guild_data (id, discord_server_id, discord_server_name, verification_role, role_mappings,
            hypixel_guild_id, requests_enabled, logs_channel_id, guild_member_role, application_ping)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const insertPlayer = db.prepare(
        `INSERT INTO linked_players (id, discord_id, hypixel_uuid, hypixel_name, guild_data_id, linked_at)
        VALUES (?, ?, ?, ?, ?, ?)`
    );

    const insertApp = db.prepare(
        `INSERT INTO open_applications (id, guild_data_id, logs_message_id, discord_user_id,
            minecraft_name, profile_name, hypixel_uuid, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );

    db.exec('BEGIN');
    try {
        if(force) {
            db.exec('DELETE FROM open_applications');
            db.exec('DELETE FROM linked_players');
            db.exec('DELETE FROM guild_data');
        }

        for(const g of guilds) {
            insertGuild.run(
                int(g.id), text(g.discord_server_id), text(g.discord_server_name), text(g.verification_role),
                json(g.role_mappings), text(g.hypixel_guild_id), bool(g.requests_enabled),
                text(g.logs_channel_id), text(g.guild_member_role), text(g.application_ping)
            );
        }

        for(const p of players) {
            insertPlayer.run(
                int(p.id), text(p.discord_id), text(p.hypixel_uuid), text(p.hypixel_name),
                int(p.guild_data_id), time(p.linked_at)
            );
        }

        for(const a of apps) {
            insertApp.run(
                int(a.id), int(a.guild_data_id), text(a.logs_message_id), text(a.discord_user_id),
                text(a.minecraft_name), text(a.profile_name), text(a.hypixel_uuid), time(a.created_at)
            );
        }

        db.exec('COMMIT');
    } catch(err) {
        db.exec('ROLLBACK');
        throw err;
    }

    console.log('\nVerifying...');
    let ok = true;
    for(const [table, expected] of [['guild_data', guilds.length], ['linked_players', players.length], ['open_applications', apps.length]]) {
        const actual = db.prepare(`SELECT COUNT(*) c FROM ${table}`).get().c;
        const match = actual === expected;
        ok = ok && match;
        console.log(`${match ? 'OK' : 'FAIL'} ${table}: ${actual}/${expected}`);
    }

    for(const g of guilds) {
        const row = db.prepare('SELECT * FROM guild_data WHERE id = ?').get(int(g.id));
        const before = JSON.stringify(g.role_mappings ?? null);
        const after = JSON.stringify(row.role_mappings ? JSON.parse(row.role_mappings) : null);
        const match = before === after;
        ok = ok && match;
        console.log(`${match ? 'OK' : 'FAIL'} role_mappings round-trip for guild id=${g.id}`);

        const idMatch = row.discord_server_id === String(g.discord_server_id);
        ok = ok && idMatch;
        console.log(`${idMatch ? 'OK' : 'FAIL'} snowflake preserved: ${row.discord_server_id}`);
    }

    const orphans = db.prepare(
        `SELECT COUNT(*) c FROM linked_players p
        LEFT JOIN guild_data g ON g.id = p.guild_data_id WHERE g.id IS NULL`
    ).get().c;
    ok = ok && orphans === 0;
    console.log(`${orphans === 0 ? 'OK' : 'FAIL'} foreign keys: ${orphans} orphaned linked_players`);

    console.log(ok ? '\nMigration complete.' : '\nMigration finished WITH FAILURES');
    process.exitCode = ok ? 0 : 1;
}

main()
    .catch(err => {
        console.error('\nMigration failed:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
