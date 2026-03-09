module.exports = {
    name: "lyrics",

    async execute(sock, msg, args = []) {
        const from = msg.key.remoteJid;
        const query = args.join(" ").trim();
        if (!query) {
            await sock.sendMessage(from, { text: "Usage: !lyrics <song> by <artist>" }, { quoted: msg });
            return;
        }

        const encoded = encodeURIComponent(query);
        await sock.sendMessage(from, {
            text: `Lyrics search for "${query}"\n\nGenius: https://genius.com/search?q=${encoded}\nAZLyrics: https://search.azlyrics.com/search.php?q=${encoded}`
        }, { quoted: msg });
    }
};
