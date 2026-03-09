const { formatMessage } = require('../fomatter')

module.exports = {
    name: "alive",

    async execute(sock, msg) {
        const from = msg.key.remoteJid

        // Quick ack to prove the bot process is responsive
        const start = Date.now()
        try {
            await sock.sendMessage(from, { text: '✅ ALIVE' })
        } catch (err) {
            console.error('Failed to send quick alive ack:', err)
        }

        // After a short delay, send a more detailed status (slower reply)
        setTimeout(async () => {
            try {
                const latency = Date.now() - start
                const mem = process.memoryUsage()
                const uptime = Math.floor(process.uptime())
                const owner = global.ownerJid ? '+' + global.ownerJid.split('@')[0] : 'Not set (using bot number)'

                const body = `Bot Status\n\nLatency: ${latency}ms\nUptime: ${uptime}s\nMemory: ${(mem.rss/1024/1024).toFixed(2)} MB\nOwner: ${owner}`
                const result = formatMessage('ALIVE', body)
                await sock.sendMessage(from, { text: result })
            } catch (err) {
                console.error('Failed to send alive details:', err)
            }
        }, 1400)
    }
}
