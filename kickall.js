const { isSameUser } = require("../utils/identity");

module.exports = {
    name: "kickall",

    async execute(sock, msg) {
        const jid = msg.key.remoteJid;
        try {
            if (!jid.endsWith("@g.us")) {
                await sock.sendMessage(jid, { text: "This command works only in groups." }, { quoted: msg });
                return;
            }

            const sender = msg.key.participant || msg.participant || msg.key.remoteJid;
            const ownerJid = global.ownerJid || sock.user?.id;
            if (!isSameUser(sender, ownerJid) && !msg.key.fromMe) {
                await sock.sendMessage(jid, { text: "Only bot owner can use !kickall." }, { quoted: msg });
                return;
            }

            const metadata = await sock.groupMetadata(jid);
            const participants = metadata.participants || [];
            const botJid = (sock.user?.id || "").split(":")[0] + "@s.whatsapp.net";
            const botData = participants.find((p) => isSameUser(p.id, botJid));
            const ownerData = participants.find((p) => isSameUser(p.id, ownerJid));
            if (!botData?.admin && !ownerData?.admin) {
                await sock.sendMessage(jid, { text: "I need admin rights to kick members." }, { quoted: msg });
                return;
            }

            const targets = participants
                .map((p) => p.id)
                .filter((id) => !isSameUser(id, botJid) && !isSameUser(id, ownerJid));

            if (!targets.length) {
                await sock.sendMessage(jid, { text: "No removable members found." }, { quoted: msg });
                return;
            }

            await sock.groupParticipantsUpdate(jid, targets, "remove");
            await sock.sendMessage(jid, { text: `Removed ${targets.length} member(s).` }, { quoted: msg });
        } catch (err) {
            console.error("Kickall command error:", err);
            await sock.sendMessage(jid, { text: "Failed to run kickall." }, { quoted: msg });
        }
    }
};
