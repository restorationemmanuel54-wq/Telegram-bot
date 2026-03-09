const { formatMessage } = require('../fomatter');
const { saveOwner } = require('../ownerStorage');
const { isSameUser } = require('../utils/identity');

module.exports = {
    name: "setowner",

    async execute(sock, msg, args = []) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;

        // Only current owner or bot account can set owner
        const currentOwner = global.ownerJid || sock.user.id;
        if (!isSameUser(sender, currentOwner) && !msg.key.fromMe) {
            await sock.sendMessage(from, {
                text: formatMessage("SETOWNER", "❌ Only the current owner can change the owner!")
            }, { quoted: msg });
            return;
        }

        if (args.length === 0) {
            const current = global.ownerJid ? "+" + global.ownerJid.split("@")[0] : "Not set (using bot number)";
            await sock.sendMessage(from, {
                text: formatMessage("SETOWNER", `Current owner: ${current}\n\nUse !setowner <number> to set new owner (e.g., +234xxxxxxxx71)`)
            }, { quoted: msg });
            return;
        }

        const number = args[0].replace(/\D/g, "");
        if (number.length < 10 || number.length > 15) {
            await sock.sendMessage(from, {
                text: formatMessage("SETOWNER", "❌ Invalid number! Provide a valid WhatsApp number (10-15 digits)")
            }, { quoted: msg });
            return;
        }

        const newOwnerJid = `${number}@s.whatsapp.net`;
        global.ownerJid = newOwnerJid;
        saveOwner(newOwnerJid);
        await sock.sendMessage(from, { text: formatMessage("SETOWNER", `✅ Owner set to +${number}`) }, { quoted: msg });
    }
};
