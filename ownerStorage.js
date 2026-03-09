const fs = require('fs');
const path = require('path');

// keep owner info in the same sessions folder used by other utilities
const SESSIONS = path.join(__dirname, '..', 'sessions');
if (!fs.existsSync(SESSIONS)) fs.mkdirSync(SESSIONS, { recursive: true });
const OWNER_FILE = path.join(SESSIONS, 'owner.json');

function loadOwner() {
    try {
        const raw = fs.readFileSync(OWNER_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return parsed.owner || null;
    } catch (e) {
        return null;
    }
}

function saveOwner(jid) {
    try {
        fs.writeFileSync(OWNER_FILE, JSON.stringify({ owner: jid }, null, 2), 'utf8');
    } catch (e) {
        console.error('ownerStorage: failed to save owner jid', e);
    }
}

module.exports = { loadOwner, saveOwner };
