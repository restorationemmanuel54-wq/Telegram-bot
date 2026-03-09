module.exports = {
    name: "uptime",

    async execute(sock, msg) {
        const from = msg.key.remoteJid;
        const sec = (global.botStartTime && Number.isFinite(global.botStartTime))
            ? Math.max(0, Math.floor((Date.now() - global.botStartTime) / 1000))
            : Math.max(0, Math.floor(process.uptime()));
        const d = Math.floor(sec / 86400);
        const h = Math.floor((sec % 86400) / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        await sock.sendMessage(from, { text: `Uptime: ${d}d ${h}h ${m}m ${s}s` }, { quoted: msg });
    }
};
