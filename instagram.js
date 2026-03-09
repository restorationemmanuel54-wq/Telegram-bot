module.exports = {
    name: "instagram",

    async execute(sock, m) {
        await sock.sendMessage(
            m.key.remoteJid,
            { text: "Instagram downloader is temporarily unavailable. Use yt/tiktok for now." },
            { quoted: m }
        );
    }
};
