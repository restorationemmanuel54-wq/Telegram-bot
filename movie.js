module.exports = {
    name: "movie",

    async execute(sock, msg, args = []) {
        const from = msg.key.remoteJid;
        const query = args.join(" ").trim();
        if (!query) {
            await sock.sendMessage(from, { text: "Usage: !movie <movie name>" }, { quoted: msg });
            return;
        }

        const q = encodeURIComponent(query);
        await sock.sendMessage(from, {
            text: `Movie search for "${query}"\n\nIMDb: https://www.imdb.com/find?q=${q}\nTMDB: https://www.themoviedb.org/search?query=${q}\nRotten Tomatoes: https://www.rottentomatoes.com/search?search=${q}`
        }, { quoted: msg });
    }
};
