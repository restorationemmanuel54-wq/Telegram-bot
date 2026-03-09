module.exports = {
    name: "link",

    async execute(sock, msg, args = []) {
        const from = msg.key.remoteJid;
        const number = (args[0] || "").replace(/\D/g, "");
        if (!number) {
            await sock.sendMessage(from, { text: "Usage: !link <phone_number>" }, { quoted: msg });
            return;
        }

        try {
            const code = await sock.requestPairingCode(number);
            const formatted = code?.match(/.{1,4}/g)?.join("-") || code;
            await sock.sendMessage(from, {
                text: `Pairing code for ${number}:\n${formatted}\n\nWhatsApp > Linked Devices > Link with phone number`
            }, { quoted: msg });
        } catch (err) {
            console.error("Link command error:", err);
            await sock.sendMessage(from, {
                text: "Failed to generate pairing code. If bot is already linked, unlink first and try again."
            }, { quoted: msg });
        }
    }
};
