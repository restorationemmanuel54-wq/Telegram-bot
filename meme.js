module.exports = {
    name: "meme",

    async execute(sock, msg) {
        const memes = [
            "When the bug disappears after you add a console.log.",
            "Works on my machine.",
            "Deploy on Friday? Bold choice.",
            "Me: just one more feature. Also me at 3AM: why is prod down?"
        ];
        const pick = memes[Math.floor(Math.random() * memes.length)];
        await sock.sendMessage(msg.key.remoteJid, { text: `Meme:\n${pick}` }, { quoted: msg });
    }
};
