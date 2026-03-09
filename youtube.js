module.exports = {
    name: "yt",

    async execute(sock, m, args) {
        let ytdl;
        try {
            ytdl = require("ytdl-core");
        } catch (_) {
            return sock.sendMessage(m.key.remoteJid, {
                text: "ytdl-core is not installed. Run: npm i ytdl-core"
            }, { quoted: m });
        }

        const url = args[0];

        if (!url || !ytdl.validateURL(url)) {
            return sock.sendMessage(m.key.remoteJid, {
                text: "❌ Please provide a valid YouTube URL"
            }, { quoted: m });
        }

        try {

            // ⬇️ reaction
            await sock.sendMessage(m.key.remoteJid, {
                react: { text: "⬇️", key: m.key }
            });

            const info = await ytdl.getInfo(url);
            const title = info.videoDetails.title;

            // premium loading message
            await sock.sendMessage(m.key.remoteJid, {
                text:
`╭━━━〔 👑 NEXORA PREMIUM 〕━━━╮
┃ 🎬 YouTube Downloader
┃ ⚡ Fetching HD Video...
┃ 📡 Optimizing Quality
╰━━━━━━━━━━━━━━━━━━━━━━╯`
            }, { quoted: m });

            const videoStream = ytdl(url, { quality: "18" });

            await sock.sendMessage(m.key.remoteJid, {
                video: videoStream,
                caption:
`╭━━━〔 👑 NEXORA PREMIUM 〕━━━╮
┃ 🎬 ${title}
┃ 📥 HD Video Download
┃ ⚡ Powered by Nexora
╰━━━━━━━━━━━━━━━━━━━━━━╯`
            }, { quoted: m });

            // success reaction
            await sock.sendMessage(m.key.remoteJid, {
                react: { text: "✅", key: m.key }
            });

        } catch (err) {

            console.log(err);

            await sock.sendMessage(m.key.remoteJid, {
                react: { text: "❌", key: m.key }
            });

            await sock.sendMessage(m.key.remoteJid, {
                text:
`╭━━━〔 ❌ ERROR 〕━━━╮
┃ Failed to fetch video
┃ Try another link
╰━━━━━━━━━━━━━━╯`
            }, { quoted: m });

        }
    }
};
