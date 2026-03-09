module.exports = {
    name: "devjoke",

    async execute(sock, msg) {
        const jokes = [
            "Why do programmers confuse Halloween and Christmas? Because OCT 31 == DEC 25.",
            "I changed my password to 'incorrect' so the computer reminds me when I forget.",
            "A SQL query walks into a bar, walks up to two tables and asks: 'Can I join you?'",
            "There are only 10 types of people: those who understand binary and those who don't."
        ];
        const pick = jokes[Math.floor(Math.random() * jokes.length)];
        await sock.sendMessage(msg.key.remoteJid, { text: pick }, { quoted: msg });
    }
};
