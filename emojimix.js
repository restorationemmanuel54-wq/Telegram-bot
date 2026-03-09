module.exports = {
    name: "emojimix",

    async execute(sock, msg, args = []) {
        const from = msg.key.remoteJid;
        const raw = args.join(" ").trim();
        const parts = raw.split("+").map((x) => x.trim()).filter(Boolean);
        if (parts.length !== 2) {
            await sock.sendMessage(from, { text: "Usage: !emojimix <emoji1>+<emoji2>" }, { quoted: msg });
            return;
        }

        await sock.sendMessage(from, { text: `Emoji Mix: ${parts[0]}${parts[1]}` }, { quoted: msg });
    }
};
