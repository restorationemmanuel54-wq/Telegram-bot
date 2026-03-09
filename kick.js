const { isSameUser } = require("../utils/identity");

module.exports = {
    name: "kick",
    description: "Kick a member from the group (Admin only)",

    async execute(sock, m, args) {
        try {
            const jid = m.key.remoteJid;

            if (!jid.endsWith("@g.us")) {
                return sock.sendMessage(jid, { text: "This command works only in groups." }, { quoted: m });
            }

            const groupMetadata = await sock.groupMetadata(jid);
            const participants = groupMetadata.participants;
            const sender = m.key.participant;
            const botJid = (sock.user?.id || "").split(":")[0] + "@s.whatsapp.net";
            const ownerJid = global.ownerJid || sock.user?.id;
            const senderIsAdmin = participants.find((p) => isSameUser(p.id, sender))?.admin;
            const botIsAdmin = participants.find((p) => isSameUser(p.id, botJid))?.admin;
            const ownerIsAdmin = participants.find((p) => isSameUser(p.id, ownerJid))?.admin;

            if (!senderIsAdmin) {
                return sock.sendMessage(jid, { text: "Only group admins can kick members." }, { quoted: m });
            }

            if (!botIsAdmin && !ownerIsAdmin) {
                return sock.sendMessage(jid, { text: "I need admin rights to kick members." }, { quoted: m });
            }

            let target = m.message.extendedTextMessage?.contextInfo?.participant || null;

            if (!target && args[0]) {
                target = args[0].replace(/[^0-9]/g, "") + "@s.whatsapp.net";
            }

            if (!target) {
                return sock.sendMessage(jid, { text: "Reply to a user or mention to kick." }, { quoted: m });
            }

            await sock.groupParticipantsUpdate(jid, [target], "remove");

            await sock.sendMessage(jid, {
                text: `Successfully kicked user: @${target.split("@")[0]}`,
                mentions: [target]
            });
        } catch (err) {
            console.error("Kick command error:", err);
            await sock.sendMessage(m.key.remoteJid, {
                text: "Failed to kick user. Make sure the bot is admin."
            }, { quoted: m });
        }
    }
};
