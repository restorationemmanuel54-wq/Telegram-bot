const { formatMessage } = require('../fomatter')
const fs = require('fs')
const path = require('path')

const SESSIONS = path.join(__dirname, '..', '..', 'sessions')
if (!fs.existsSync(SESSIONS)) fs.mkdirSync(SESSIONS, { recursive: true })
const STATE_FILE = path.join(SESSIONS, 'antidelete.json')
const CACHE_FILE = path.join(SESSIONS, 'message_cache.json')
const LOG_FILE = path.join(SESSIONS, 'antidelete_caught.json')

function loadJson(fp) {
    try { return JSON.parse(fs.readFileSync(fp, 'utf8') || '{}') } catch (e) { return {} }
}
function saveJson(fp, data) { fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf8') }

let state = loadJson(STATE_FILE)
let cache = loadJson(CACHE_FILE)

async function ensureListeners(sock) {
    if (sock._nexoraAntiDeleteAttached) return
    sock._nexoraAntiDeleteAttached = true

    // Cache incoming messages so we can reveal them if deleted later
    sock.ev.on('messages.upsert', async (m) => {
        try {
            if (m.type !== 'notify') return
            for (const msg of m.messages) {
                // store normal incoming messages (not protocol messages)
                if (msg?.message && !msg.message.protocolMessage) {
                    const id = msg.key.id || (msg.message?.conversation && `${msg.key.remoteJid}_${msg.key.fromMe}_${Date.now()}`)
                    if (!id) continue
                    cache[id] = {
                        key: msg.key,
                        message: msg.message,
                        pushName: msg.pushName || null,
                        timestamp: msg.messageTimestamp || Date.now(),
                        raw: msg
                    }
                }

                // detect revoke (deleted message)
                if (msg?.message && msg.message.protocolMessage) {
                    const proto = msg.message.protocolMessage
                    // protocol type 0 means a revoke (message deleted)
                    if (proto.type === 0 && proto.key) {
                        handleRevoke(sock, proto.key).catch(console.error)
                    }
                }
            }
            saveJson(CACHE_FILE, cache)
        } catch (e) {
            console.error('antidelete upsert handler error', e)
        }
    })

    // Also listen for updates just in case
    sock.ev.on('messages.update', async (updates) => {
        try {
            for (const upd of updates) {
                if (upd?.update?.message?.protocolMessage) {
                    const proto = upd.update.message.protocolMessage
                    if (proto.type === 0 && proto.key) {
                        handleRevoke(sock, proto.key).catch(console.error)
                    }
                }
            }
        } catch (e) {
            console.error('antidelete update handler error', e)
        }
    })
}

async function handleRevoke(sock, revokedKey) {
    try {
        const id = revokedKey.id
        const cached = cache[id]
        const ownerTargets = []
        if (global.ownerJid) ownerTargets.push(global.ownerJid)
        if (global.personalJid && global.personalJid !== global.ownerJid) ownerTargets.push(global.personalJid)

        // if nothing was pushed, fall back to bot account so something is delivered
        if (!ownerTargets.length) {
            console.log('antidelete: no explicit owner configured, defaulting to bot account');
            ownerTargets.push(sock.user.id);
        }

        const chatId = revokedKey.remoteJid
        if (!state[chatId]) return // only act if enabled for that chat

        const sender = revokedKey.participant || revokedKey.fromMe ? revokedKey.fromMe : revokedKey.participant || 'unknown'
        let groupName = null
        try {
            if (chatId && chatId.endsWith('@g.us')) {
                const metadata = await sock.groupMetadata(chatId).catch(() => null)
                groupName = metadata?.subject || null
            }
        } catch (e) { /* ignore */ }

        const time = new Date().toLocaleString()

        let body = `🚨 Nexora Anti-Delete Alert

• Sender: ${sender}
• Chat: ${chatId}${groupName ? ` (${groupName})` : ''}
• Time: ${time}
`

        if (cached) {
            // Try to include text if it exists
            const text = cached.message.conversation || cached.message?.extendedTextMessage?.text || cached.message?.templateButtonReplyMessage?.selectedButtonId || ''
            if (text) body += `• Message: ${text}\n`;
        } else {
            body += '• Message: (not cached)\n'
        }

        const result = formatMessage('DELETED MESSAGE ALERT🚨', body)

        // if the only target is the bot itself, log a warning so owner remembers to set a real owner
        if (ownerTargets.length === 1 && ownerTargets[0] === sock.user.id) {
            console.log('antidelete: owner target is bot account itself; run !setowner to receive alerts on your personal number');
        }

        // send to owners
        for (const target of ownerTargets) {
            try {
                await sock.sendMessage(target, { text: result })
                // if we have a cached raw message, attempt to forward it too
                if (cached && cached.raw) {
                    try {
                        // attempt to forward original message to owner
                        if (sock.copyNForward) {
                            await sock.copyNForward(target, cached.raw, true)
                        } else if (cached.message?.conversation) {
                            await sock.sendMessage(target, { text: `Forwarded content:\n${cached.message.conversation}` })
                        }
                    } catch (e) {
                        // best-effort; ignore
                        await sock.sendMessage(target, { text: `Unable to forward original content (may be media).` })
                    }
                }
            } catch (e) {
                console.error('Failed to notify owner about deleted message', e)
            }
        }

        // log it
        const logEntry = { revokedKey, cached: cached ? { pushName: cached.pushName, timestamp: cached.timestamp, message: (cached.message.conversation || null) } : null, time }
        let logs = []
        try { logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8') || '[]') } catch (e) { logs = [] }
        logs.push(logEntry)
        fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2))

    } catch (e) {
        console.error('handleRevoke error', e)
    }
}

module.exports = {
    name: 'antidelete',
    // accept args so main dispatcher passes args
    async execute(sock, msg, args) {
        const from = msg.key.remoteJid
        await ensureListeners(sock)

        const arg = (args && args[0]) ? args[0].toString().toLowerCase() : null
        if (!arg) {
            const enabled = !!state[from]
            const body = enabled ? '✅ Antidelete is currently *ON* for this chat.' : '⚪ Antidelete is currently *OFF* for this chat.'
            const result = formatMessage('ANTIDELETE STATUS', body)
            return await sock.sendMessage(from, { text: result })
        }

        if (arg === 'on' || arg === 'enable') {
            state[from] = true
            saveJson(STATE_FILE, state)
            await sock.sendMessage(from, { text: formatMessage('ANTIDELETE', '✅ Antidelete has been *ENABLED* for this chat. I will capture deleted messages and notify the owner.') })
            return
        }

        if (arg === 'off' || arg === 'disable') {
            state[from] = false
            saveJson(STATE_FILE, state)
            await sock.sendMessage(from, { text: formatMessage('ANTIDELETE', '⚪ Antidelete has been *DISABLED* for this chat.') })
            return
        }

        await sock.sendMessage(from, { text: formatMessage('ANTIDELETE', 'Usage: !antidelete on | off') })
    }
}
