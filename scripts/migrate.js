const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { db } = require('../database.js');

const dir = path.join(__dirname, '..', 'migrations');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();

const current = db.prepare('PRAGMA user_version').get().user_version;
console.log(`Schema version: ${current}`);

let applied = 0;

for(const file of files) {
    const version = parseInt(file, 10);
    if(!version || version <= current) continue;

    console.log(`Applying ${file}...`);
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec('BEGIN');

    try {
        db.exec(fs.readFileSync(path.join(dir, file), 'utf8'));
        db.exec(`PRAGMA user_version = ${version}`);
        db.exec('COMMIT');
        applied++;
    } catch(err) {
        db.exec('ROLLBACK');
        db.exec('PRAGMA foreign_keys = ON');
        console.error(`Failed applying ${file}: ${err.message}`);
        process.exit(1);
    }

    db.exec('PRAGMA foreign_keys = ON');
}

if(applied === 0) {
    console.log('Already up to date.');
    process.exit(0);
}

const violations = db.prepare('PRAGMA foreign_key_check').all();
const integrity = db.prepare('PRAGMA integrity_check').get().integrity_check;

console.log(`\nforeign_key_check: ${violations.length} violations`);
console.log(`integrity_check: ${integrity}`);
console.log(`\nApplied ${applied} migration(s). Now at version ${db.prepare('PRAGMA user_version').get().user_version}.`);

process.exitCode = violations.length === 0 && integrity === 'ok' ? 0 : 1;
