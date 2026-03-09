const { isSameUser } = require("../utils/identity");

module.exports = {
    name: "demote",

    async execute(sock, msg, args = []) {
        const jid = msg.key.remoteJid;
        try {
            if (!jid.endsWith("@g.us")) {
                await sock.sendMessage(jid, { text: "This command works only in groups." }, { quoted: msg });
                return;
            }

            const metadata = await sock.groupMetadata(jid);
            const participants = metadata.participants || [];
            const sender = msg.key.participant || msg.participant || msg.key.remoteJid;
            const botJid = (sock.user?.id || "").split(":")[0] + "@s.whatsapp.net";

            const ownerJid = global.ownerJid || sock.user?.id;
            const senderData = participants.find((p) => isSameUser(p.id, sender));
            const botData = participants.find((p) => isSameUser(p.id, botJid));
            const ownerData = participants.find((p) => isSameUser(p.id, ownerJid));
            if (!senderData?.admin) {
                await sock.sendMessage(jid, { text: "Only admins can use !demote." }, { quoted: msg });
                return;
            }
            if (!botData?.admin && !ownerData?.admin) {
                await sock.sendMessage(jid, { text: "I need admin rights to demote users." }, { quoted: msg });
                return;
            }

            const contextInfo = msg.message?.extendedTextMessage?.contextInfo || {};
            const mentioned = contextInfo.mentionedJid || [];
            const replied = contextInfo.participant || null;
            let target = mentioned[0] || replied || null;
            if (!target && args[0]) {
                const n = args[0].replace(/\D/g, "");
                if (n) target = `${n}@s.whatsapp.net`;
            }

            if (!target) {
                await sock.sendMessage(jid, { text: "Usage: !demote @user (or reply to user's message)." }, { quoted: msg });
                return;
            }

            await sock.groupParticipantsUpdate(jid, [target], "demote");
            await sock.sendMessage(jid, {
                text: `Demoted @${target.split("@")[0]} from admin.`,
                mentions: [target]
            }, { quoted: msg });
        } catch (err) {
            console.error("Demote command error:", err);
            await sock.sendMessage(jid, { text: "Failed to demote user." }, { quoted: msg });
        }
    }
};
