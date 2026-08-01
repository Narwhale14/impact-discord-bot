const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'bot.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA busy_timeout = 5000');
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

console.log(`Database ready at ${dbPath}`);

module.exports = { db };
