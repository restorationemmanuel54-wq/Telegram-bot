const { formatMessage } = require('../fomatter')

module.exports = {
    name: 'ping',

    async execute(sock, msg) {
        const from = msg.key.remoteJid

        const ts = Number(msg?.messageTimestamp || 0)
        const sentAtMs = ts > 0 ? (ts < 1e12 ? Math.floor(ts * 1000) : Math.floor(ts)) : Date.now()
        const incomingLatency = Math.max(0, Date.now() - sentAtMs)

        const responseStart = process.hrtime.bigint()
        try {
            await sock.sendMessage(from, { react: { text: '🏓', key: msg.key } })
        } catch (_) {
            // reaction may fail in some chats, continue with fallback timing
        }
        const responseMs = Number(process.hrtime.bigint() - responseStart) / 1e6

        const overallMs = Math.round((incomingLatency + responseMs) / 2)
        let status = 'Optimal'
        if (overallMs > 250) status = 'High Latency'
        if (overallMs > 600) status = 'Poor'

        const body = `
NETWORK ANALYTICS
Latency: ${incomingLatency}ms
Response: ${responseMs.toFixed(2)}ms
Overall: ${overallMs}ms
Status: ${status}
`

        const result = formatMessage('PING', body)
        await sock.sendMessage(from, { text: result }, { quoted: msg })
    }
}
