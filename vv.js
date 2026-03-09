const { formatMessage } = require('../fomatter')

module.exports = {
    name: 'vv',
    async execute(sock, msg) {
        const from = msg.key.remoteJid

        // Make sure the command was sent as a reply
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
        const quotedKey = msg.message?.extendedTextMessage?.contextInfo?.stanzaId || msg.message?.extendedTextMessage?.contextInfo?.participant

        if (!quoted || !msg.message?.extendedTextMessage?.contextInfo) {
            return await sock.sendMessage(from, { text: formatMessage('VIEW-ONCE', '❗ Reply to a view-once image/video with !vv to reveal it.') })
        }

        try {
            // Try to grab the quoted message key from contextInfo
            const context = msg.message.extendedTextMessage.contextInfo
            const key = { remoteJid: msg.key.remoteJid, id: context.stanzaId, participant: context.participant }

            // If copyNForward is available, use it to copy and forward original message (best-effort to bypass view-once)
            if (sock.copyNForward) {
                await sock.copyNForward(from, { key, message: context.quotedMessage }, true)
                await sock.sendMessage(from, { text: formatMessage('VIEW-ONCE SAVED', '🛰️ Nexora ⚡ anti view-once download completed. Content forwarded successfully.') })
                return
            }

            // Fallback: if quoted contains text, forward text
            const qmsg = context.quotedMessage
            const txt = qmsg.conversation || qmsg.extendedTextMessage?.text || null
            if (txt) {
                await sock.sendMessage(from, { text: formatMessage('VIEW-ONCE SAVED', `🛰️ Nexora ⚡ anti view-once download completed. Forwarded text:\n${txt}`) })
                return
            }

            // Fallback for media (image/video/audio/document/sticker)
            const mediaTypes = ['imageMessage','videoMessage','audioMessage','documentMessage','stickerMessage']
            for (const type of mediaTypes) {
                if (qmsg[type]) {
                    try {
                        const buffer = await sock.downloadMediaMessage({ message: qmsg })
                        const payload = {}
                        if (type === 'imageMessage' || type === 'stickerMessage') payload.image = { buffer }
                        else if (type === 'videoMessage') payload.video = { buffer }
                        else if (type === 'audioMessage') payload.audio = { buffer }
                        else if (type === 'documentMessage') payload.document = { buffer }

                        await sock.sendMessage(from, payload)
                        await sock.sendMessage(from, { text: formatMessage('VIEW-ONCE SAVED', '🛰️ Nexora ⚡ anti view-once download completed. Media forwarded.') })
                        return
                    } catch (e) {
                        console.error('vv fallback media download error', e)
                    }
                }
            }

            await sock.sendMessage(from, { text: formatMessage('VIEW-ONCE', '⚠️ Unable to extract content from the quoted view-once message.') })
        } catch (e) {
            console.error('vv command error', e)
            await sock.sendMessage(from, { text: formatMessage('VIEW-ONCE', '❌ Error trying to save view-once content.') })
        }
    }
}
