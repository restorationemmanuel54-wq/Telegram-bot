module.exports = {
    name: "destroy",

    async execute(sock, msg, args = []) {
        const from = msg.key.remoteJid;
        const contextInfo = msg.message?.extendedTextMessage?.contextInfo || {};
        const target = (contextInfo.mentionedJid || [])[0] || (args[0] ? `${args[0].replace(/\D/g, "")}@s.whatsapp.net` : null);

        if (!target) {
            await sock.sendMessage(from, { text: "Usage: !destroy @user" }, { quoted: msg });
            return;
        }

        await sock.sendMessage(from, {
            text: `💥 @${target.split("@")[0]} has been destroyed (for fun)!`,
            mentions: [target]
        }, { quoted: msg });
    }
};
