const OpenAI = require('openai');
module.exports = {
    name: "img",
    aliases: ["image"],

    async execute(sock, msg, args) {
        const from = msg.key.remoteJid

        if (!args.length) {
            await sock.sendMessage(from, { text: "Please provide a prompt for the image, e.g., !img a cat" });
            return;
        }

        const prompt = args.join(' ');

        try {
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

            const response = await openai.images.generate({
                model: 'dall-e-3',
                prompt: prompt,
                size: '1024x1024',
                quality: 'HD',
                n: 1,
            });

            const imageUrl = response.data[0].url;

            await sock.sendMessage(from, { image: { url: imageUrl }, caption: `Generated image for: ${prompt}` });
        } catch (err) {
            console.error('Error generating image:', err);
            await sock.sendMessage(from, { text: "Error generating image. Please try again later." });
        }
    }
}
