const axios = require("axios");

module.exports = {
    name: "tiktok", // command trigger
    description: "Download TikTok videos in HD without watermark.",
    
    async execute(sock, m, args) {
        // auto-detect link if not provided in command
        const text = m.message.conversation || m.message.extendedTextMessage?.text;
        const url = args[0] || (text.match(/https?:\/\/(www\.)?tiktok\.com\/[^\s]+/)?.[0]);
        if (!url) return sock.sendMessage(m.key.remoteJid, { text: "❌ Provide a valid TikTok URL!" });

        try {
            // ⬇️ Send reaction emoji
            await sock.sendMessage(m.key.remoteJid, { react: { text: "⬇️", key: m.key } });

            // Premium loading message
            const loadingMsg = await sock.sendMessage(m.key.remoteJid, {
                text: 
`╭━━━〔 👑 NEXORA PREMIUM 〕━━━╮
┃ 🎬 TikTok HD Downloader
┃ ⚡ Fetching Ultra HD Version...
┃ 🔓 No Watermark
╰━━━━━━━━━━━━━━━━━━━━━━╯`
            }, { quoted: m });

            // Fetch HD video
            const response = await axios.get(`https://tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`);
            const videoUrl = response.data.data?.hdplay || response.data.data?.play;

            if (!videoUrl) throw new Error("Video not found!");

            // Send premium video
            await sock.sendMessage(m.key.remoteJid, {
                video: { url: videoUrl },
                caption:
`╭━━━〔 👑 NEXORA PREMIUM 〕━━━╮
┃ 🎬 TikTok Video (HD)
┃ 🚫 No Watermark
┃ ⚡ Ultra Quality
╰━━━━━━━━━━━━━━━━━━━━━━╯

✨ Thank you for using Nexora Premium`,
            }, { quoted: m });

            // ✅ Success reaction
            await sock.sendMessage(m.key.remoteJid, { react: { text: "✅", key: m.key } });

        } catch (error) {
            console.error(error);

            // ❌ Failure reaction
            await sock.sendMessage(m.key.remoteJid, { react: { text: "❌", key: m.key } });
            await sock.sendMessage(m.key.remoteJid, { text: "❌ Failed to fetch TikTok video. Check the link.", quoted: m });
        }
    }
};
