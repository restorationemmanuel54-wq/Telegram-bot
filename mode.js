const { formatMessage } = require('../fomatter');
const { isSameUser } = require('../utils/identity');

module.exports = {
    name: "mode",

    async execute(sock, msg, args = []) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const ownerJid = global.ownerJid || sock.user?.id;

        if (!ownerJid || (!isSameUser(sender, ownerJid) && !msg.key.fromMe)) {
            await sock.sendMessage(from, { text: formatMessage("MODE", "❌ Only the owner can change the bot mode!") }, { quoted: msg });
            return;
        }

        global.chatModes = global.chatModes || {};

        if (args.length === 0) {
            const currentMode = global.botMode || global.chatModes[from] || "public";
            await sock.sendMessage(from, {
                text: formatMessage("MODE", `Current mode: ${currentMode}\n\nUse !mode public or !mode private`)
            }, { quoted: msg });
            return;
        }

        const newMode = args[0].toLowerCase();
        if (newMode !== "public" && newMode !== "private") {
            await sock.sendMessage(from, { text: formatMessage("MODE", "❌ Invalid mode! Use 'public' or 'private'") }, { quoted: msg });
            return;
        }

        global.botMode = newMode;
        global.chatModes[from] = newMode;

        await sock.sendMessage(from, {
            text: formatMessage("MODE", `✅ Bot set to ${newMode}! Applied immediately.`)
        }, { quoted: msg });
    }
};
