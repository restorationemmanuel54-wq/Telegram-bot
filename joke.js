module.exports = {
    name: "joke",

    async execute(sock, msg) {
        const jokes = [
            "Why did the JavaScript developer go broke? Because he kept using up all his cache.",
            "I would tell you a UDP joke, but you might not get it.",
            "Debugging: being the detective in a crime movie where you are also the murderer.",
            "There are two hard things in CS: cache invalidation, naming things, and off-by-one errors."
        ];
        const pick = jokes[Math.floor(Math.random() * jokes.length)];
        await sock.sendMessage(msg.key.remoteJid, { text: pick }, { quoted: msg });
    }
};
