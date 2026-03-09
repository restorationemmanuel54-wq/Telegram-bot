module.exports = {
    name: "clearwarnings",

    async execute(sock, msg, args = []) {
        const jid = msg.key.remoteJid;
        if (!jid.endsWith("@g.us")) {
            await sock.sendMessage(jid, { text: "This command works only in groups." }, { quoted: msg });
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
            await sock.sendMessage(jid, { text: "Usage: !clearwarnings @user (or reply to user)." }, { quoted: msg });
            return;
        }

        if (!global.groupWarnings) global.groupWarnings = {};
        if (!global.groupWarnings[jid]) global.groupWarnings[jid] = {};
        global.groupWarnings[jid][target] = 0;

        await sock.sendMessage(jid, {
            text: `Cleared warnings for @${target.split("@")[0]}.`,
            mentions: [target]
        }, { quoted: msg });
    }
};
