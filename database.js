const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'bot.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA busy_timeout = 5000');

const isNewDatabase = !db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='guild_data'`).get();
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

if(isNewDatabase) {
    const migrationsDir = path.join(__dirname, 'migrations');
    const latest = fs.existsSync(migrationsDir)
        ? fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).reduce((max, f) => Math.max(max, parseInt(f, 10) || 0), 0)
        : 0;
    db.exec(`PRAGMA user_version = ${latest}`);
}

console.log(`Database ready at ${dbPath}`);

module.exports = { db };
