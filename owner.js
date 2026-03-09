module.exports = {
    name: "owner",

    async execute(sock, msg) {
        const from = msg.key.remoteJid;
        const ownerJid = global.ownerJid || sock.user?.id || "";
        const ownerNumber = ownerJid.split("@")[0].split(":")[0].replace(/\D/g, "");

        if (!ownerNumber) {
            await sock.sendMessage(from, { text: "Owner is not configured yet." }, { quoted: msg });
            return;
        }

        const vcard = [
            "BEGIN:VCARD",
            "VERSION:3.0",
            "FN:Nexora Owner",
            "ORG:Nexora;",
            `TEL;type=CELL;type=VOICE;waid=${ownerNumber}:${ownerNumber}`,
            "END:VCARD"
        ].join("\n");

        await sock.sendMessage(from, {
            contacts: {
                displayName: "Nexora Owner",
                contacts: [{ vcard }]
            }
        }, { quoted: msg });
    }
};
