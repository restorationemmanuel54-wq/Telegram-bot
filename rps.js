module.exports = {
    name: "rps",

    async execute(sock, msg, args = []) {
        const from = msg.key.remoteJid;
        const userChoice = (args[0] || "").toLowerCase();
        const valid = ["rock", "paper", "scissors"];
        if (!valid.includes(userChoice)) {
            await sock.sendMessage(from, { text: "Usage: !rps rock|paper|scissors" }, { quoted: msg });
            return;
        }

        const botChoice = valid[Math.floor(Math.random() * valid.length)];
        let result = "Draw!";
        if (
            (userChoice === "rock" && botChoice === "scissors") ||
            (userChoice === "paper" && botChoice === "rock") ||
            (userChoice === "scissors" && botChoice === "paper")
        ) {
            result = "You win!";
        } else if (userChoice !== botChoice) {
            result = "I win!";
        }

        await sock.sendMessage(from, {
            text: `You: ${userChoice}\nBot: ${botChoice}\nResult: ${result}`
        }, { quoted: msg });
    }
};
