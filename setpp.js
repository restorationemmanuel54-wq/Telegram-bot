const { isSameUser } = require("../utils/identity");

module.exports = {
    name: "setpp",

    async execute(sock, msg) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const ownerJid = global.ownerJid || sock.user?.id;

        if (!isSameUser(sender, ownerJid) && !msg.key.fromMe) {
            await sock.sendMessage(from, { text: "Only owner can use !setpp." }, { quoted: msg });
            return;
        }

        await sock.sendMessage(from, {
            text: "Set profile picture currently requires media processing support in this build."
        }, { quoted: msg });
    }
};
