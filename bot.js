const OpenAI = require("openai");

module.exports = {
    name: "bot",

    async execute(sock, msg, args = []) {
        const from = msg.key.remoteJid;
        const prompt = args.join(" ").trim();
        if (!prompt) {
            await sock.sendMessage(from, { text: "Usage: !bot <your question>" }, { quoted: msg });
            return;
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            await sock.sendMessage(from, {
                text: `AI is not configured yet.\nYou asked: "${prompt}"`
            }, { quoted: msg });
            return;
        }

        try {
            const client = new OpenAI({ apiKey });
            const res = await client.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: "You are Nexora assistant. Reply clearly and briefly." },
                    { role: "user", content: prompt }
                ]
            });
            const out = res.choices?.[0]?.message?.content?.trim() || "No response.";
            await sock.sendMessage(from, { text: out }, { quoted: msg });
        } catch (err) {
            console.error("Bot command error:", err);
            await sock.sendMessage(from, { text: "AI request failed. Try again later." }, { quoted: msg });
        }
    }
};
