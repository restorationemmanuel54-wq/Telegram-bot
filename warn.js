const { isSameUser } = require('../utils/identity');

module.exports = {
    name: "warn",

    async execute(sock, msg, args = []) {
        const jid = msg.key.remoteJid;
        if (!jid.endsWith("@g.us")) {
            await sock.sendMessage(jid, { text: "This command works only in groups." }, { quoted: msg });
            return;
        }

        try {
            const metadata = await sock.groupMetadata(jid);
            const participants = metadata.participants || [];
            const sender = msg.key.participant || msg.participant || msg.key.remoteJid;
            const botJid = (sock.user?.id || "").split(":")[0] + "@s.whatsapp.net";

            const ownerJid = global.ownerJid || sock.user?.id;
            const senderData = participants.find((p) => isSameUser(p.id, sender));
            const botData = participants.find((p) => isSameUser(p.id, botJid));
            const ownerData = participants.find((p) => isSameUser(p.id, ownerJid));
            const senderIsAdmin = !!senderData?.admin;
            const senderIsOwner = isSameUser(sender, ownerJid);

            if (!senderIsAdmin && !senderIsOwner) {
                await sock.sendMessage(jid, { text: "Only admins or owner can use !warn." }, { quoted: msg });
                return;
            }

            if (!botData?.admin && !ownerData?.admin) {
                await sock.sendMessage(jid, { text: "I need admin rights to manage warnings properly." }, { quoted: msg });
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
                await sock.sendMessage(jid, { text: "Usage: !warn @user [reason] or reply + !warn [reason]" }, { quoted: msg });
                return;
            }

            const reason = (args.length > 1 ? args.slice(1).join(" ") : "No reason provided").trim();
            const targetData = participants.find((p) => isSameUser(p.id, target));
            if (!targetData) {
                await sock.sendMessage(jid, { text: "Target user is not in this group." }, { quoted: msg });
                return;
            }

            if (!global.groupWarnings) global.groupWarnings = {};
            if (!global.groupWarnings[jid]) global.groupWarnings[jid] = {};
            const current = global.groupWarnings[jid][target] || 0;
            const next = current + 1;
            global.groupWarnings[jid][target] = next;

            await sock.sendMessage(jid, {
                text: `⚠️ Warned @${target.split("@")[0]}\nReason: ${reason}\nTotal warnings: ${next}`,
                mentions: [target]
            }, { quoted: msg });
        } catch (error) {
            console.error("Warn command error:", error);
            await sock.sendMessage(jid, { text: "Failed to warn user." }, { quoted: msg });
        }
    }
};
