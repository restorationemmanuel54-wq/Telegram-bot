const axios = require('axios');

module.exports = {
    name: "wasted",

    async execute(sock, msg) {
        const from = msg.key.remoteJid;

        try {
            const contextInfo = msg.message?.extendedTextMessage?.contextInfo || {};
            const repliedJid = contextInfo.participant || null;
            const targetJid = repliedJid || msg.key.participant || msg.key.remoteJid;

            if (!targetJid || !String(targetJid).includes('@')) {
                await sock.sendMessage(from, {
                    text: "Reply to a user's message with !wasted so I can use their profile photo."
                }, { quoted: msg });
                return;
            }

            let avatarUrl = null;
            try {
                avatarUrl = await sock.profilePictureUrl(targetJid, 'image');
            } catch (_) {
                avatarUrl = null;
            }

            if (!avatarUrl) {
                await sock.sendMessage(from, {
                    text: "Couldn't fetch that user's profile photo."
                }, { quoted: msg });
                return;
            }

            const apiUrl = `https://api.popcat.xyz/wasted?image=${encodeURIComponent(avatarUrl)}`;
            await axios.get(apiUrl, { timeout: 15000 });

            await sock.sendMessage(from, {
                image: { url: apiUrl },
                caption: "Wasted filter applied."
            }, { quoted: msg });
        } catch (err) {
            console.error('wasted command failed:', err?.message || err);
            await sock.sendMessage(from, {
                text: "Failed to apply wasted filter. Try again in a moment."
            }, { quoted: msg });
        }
    }
};
