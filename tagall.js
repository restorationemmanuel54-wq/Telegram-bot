module.exports = {
    name: "tagall",

    async execute(sock, msg) {
        const from = msg.key.remoteJid

        // Check if this is a group
        if (!from.endsWith('@g.us')) {
            await sock.sendMessage(from, { text: 'This command can only be used in groups!' })
            return
        }

        try {
            // Get group metadata
            const groupMetadata = await sock.groupMetadata(from)
            const participants = groupMetadata.participants

            if (!participants || participants.length === 0) {
                await sock.sendMessage(from, { text: 'No participants found in this group.' })
                return
            }

            // Create tagged message
            let taggedMessage = '📢 *GROUP MEMBERS TAG*\n\n'
            let mentions = []

            participants.forEach((participant, index) => {
                const number = participant.id.split('@')[0]
                taggedMessage += `${index + 1}. @${number}\n`
                mentions.push(participant.id)
            })

            taggedMessage += `\n*Total Members: ${participants.length}*`

            await sock.sendMessage(from, {
                text: taggedMessage,
                mentions: mentions
            })

        } catch (error) {
            console.error('Error in tagall command:', error)
            await sock.sendMessage(from, { text: 'Error retrieving group information.' })
        }
    }
}
