module.exports = {
    name: "quote",

    async execute(sock, msg) {
        const quotes = [
            "First, solve the problem. Then, write the code. - John Johnson",
            "Programs must be written for people to read. - Harold Abelson",
            "Simplicity is prerequisite for reliability. - Edsger Dijkstra",
            "Make it work, make it right, make it fast. - Kent Beck"
        ];
        const pick = quotes[Math.floor(Math.random() * quotes.length)];
        await sock.sendMessage(msg.key.remoteJid, { text: pick }, { quoted: msg });
    }
};
