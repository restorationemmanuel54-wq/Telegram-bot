const axios = require('axios');

module.exports = {
    name: 'ttsearch',
    aliases: ['tiktoks', 'searchtt'],

    async execute(sock, m, args = []) {
        const from = m.key.remoteJid;
        const query = args.join(' ').trim();

        if (!query) {
            await sock.sendMessage(from, {
                text: 'Usage: !ttsearch <search query>\nExample: !ttsearch funny cats'
            }, { quoted: m });
            return;
        }

        await sock.sendMessage(from, { react: { text: '🔎', key: m.key } });
        await sock.sendMessage(from, {
            text: `🔎 Searching TikTok for: ${query}...\nGenerating results...`
        }, { quoted: m });

        try {
            const { data } = await axios.get('https://www.tikwm.com/api/feed/search', {
                params: { keywords: query },
                timeout: 20000
            });

            const videos = data?.data?.videos;
            if (data?.code !== 0 || !Array.isArray(videos) || videos.length === 0) {
                throw new Error('No TikToks found.');
            }

            const top = videos.slice(0, 5);
            const lines = top.map((tt, idx) => {
                const title = (tt?.title || 'TikTok Video').replace(/\s+/g, ' ').trim();
                const shortTitle = title.length > 70 ? `${title.slice(0, 67)}...` : title;
                const authorName = tt?.author?.nickname || 'Unknown';
                const authorId = tt?.author?.unique_id || 'tiktok';
                const videoId = tt?.video_id;
                const link = videoId ? `https://www.tiktok.com/@${authorId}/video/${videoId}` : 'N/A';

                return `${idx + 1}. ${shortTitle}\n👤 ${authorName}\n🔗 ${link}`;
            });

            const out = `🎵 TikTok Results for: ${query}\n\n${lines.join('\n\n')}\n\nUse your downloader command with any link above.`;

            await sock.sendMessage(from, { text: out }, { quoted: m });
            await sock.sendMessage(from, { react: { text: '✅', key: m.key } });
        } catch (e) {
            await sock.sendMessage(from, { react: { text: '❌', key: m.key } });
            await sock.sendMessage(from, {
                text: `Error: ${e.message}`
            }, { quoted: m });
        }
    }
};
    