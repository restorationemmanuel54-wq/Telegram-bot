const { isSameUser } = require("../utils/identity");

module.exports = {
    name: "promote",

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
            const botJid = sock.user?.id?.split(":")[0] + "@s.whatsapp.net";

            const ownerJid = global.ownerJid || sock.user?.id;
            const senderData = participants.find((p) => isSameUser(p.id, sender));
            const botData = participants.find((p) => isSameUser(p.id, botJid));
            const ownerData = participants.find((p) => isSameUser(p.id, ownerJid));
            const senderIsAdmin = !!senderData?.admin;
            const botIsAdmin = !!botData?.admin || !!ownerData?.admin;

            if (!senderIsAdmin) {
                await sock.sendMessage(jid, { text: "Only group admins can use !promote." }, { quoted: msg });
                return;
            }

            if (!botIsAdmin) {
                await sock.sendMessage(jid, { text: "I need admin rights to promote users." }, { quoted: msg });
                return;
            }

            const contextInfo = msg.message?.extendedTextMessage?.contextInfo || {};
            const mentioned = contextInfo.mentionedJid || [];
            const replied = contextInfo.participant || null;
            let target = mentioned[0] || replied || null;

            if (!target && args[0]) {
                const number = args[0].replace(/\D/g, "");
                if (number) target = `${number}@s.whatsapp.net`;
            }

            if (!target) {
                await sock.sendMessage(jid, { text: "Usage: !promote @user (or reply to user's message)." }, { quoted: msg });
                return;
            }

            if (target === sender) {
                await sock.sendMessage(jid, { text: "You are already in control of your own role." }, { quoted: msg });
                return;
            }

            const targetData = participants.find((p) => p.id === target);
            if (!targetData) {
                await sock.sendMessage(jid, { text: "Target user is not in this group." }, { quoted: msg });
                return;
            }

            if (targetData.admin) {
                await sock.sendMessage(jid, { text: "That user is already an admin." }, { quoted: msg });
                return;
            }

            await sock.groupParticipantsUpdate(jid, [target], "promote");
            await sock.sendMessage(jid, {
                text: `Promoted @${target.split("@")[0]} to admin.`,
                mentions: [target]
            }, { quoted: msg });
        } catch (error) {
            console.error("Promote command error:", error);
            await sock.sendMessage(jid, {
                text: "Failed to promote user. Ensure bot is admin and target is valid."
            }, { quoted: msg });
        }
    }
};
