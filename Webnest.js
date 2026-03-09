// Webnest.js - Nexora V2 starter bot (QR shown in terminal using qrcode-terminal)
const path = require('path');
const fs = require('fs');

// load environment variables (OPENAI_API_KEY, OWNER_JID, etc.) when dotenv is available
try {
    require('dotenv').config({ path: path.join(__dirname, '.env') });
} catch (_) {
    // dotenv is optional at runtime; skip when not installed
}

let qrcodeTerminal = null;
let qrcodeLib = null;
try {
    qrcodeTerminal = require('qrcode-terminal');
} catch (_) {
    // Fallback to raw QR string logging when qrcode-terminal isn't installed
}
try {
    qrcodeLib = require('qrcode');
} catch (_) {
    // Optional fallback renderer
}
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const P = require('pino');
const { isSameUser } = require('./utils/identity');

// simple helper to persist owner JID across restarts
const { loadOwner } = require('./ownerStorage');

let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
let consecutive405Failures = 0;
let authResetAttempts = 0;
const maxAuthResetAttempts = 3;
let reconnectTimer = null;
let isSocketStarting = false;

global.chatModes = global.chatModes || {}; // { chatId: 'public' | 'private' }
let authCleared = false;
const CHANNEL_LINK = process.env.NEWSLETTER_LINK || 'https://whatsapp.com/channel/0029VbCFEZv60eBdlqXqQz20';
const channelCodeMatch = CHANNEL_LINK.match(/\/channel\/([A-Za-z0-9]+)/);
const CHANNEL_CODE = channelCodeMatch?.[1] || '0029VbCFEZv60eBdlqXqQz20';
const DEFAULT_NEWSLETTER_JID = process.env.NEWSLETTER_JID || `${CHANNEL_CODE}@newsletter`;

// initialize ownerJid from persisted storage or environment variable if available
global.ownerJid = loadOwner() || process.env.OWNER_JID || null;
// optional secondary notification address (e.g. your personal chat) can be set via env
global.personalJid = process.env.PERSONAL_JID || null;
global.botStartTime = global.botStartTime || Date.now();

function clearAuthInfo(reasonLabel) {
    const authPath = path.join(__dirname, 'auth_info');
    if (!fs.existsSync(authPath)) return true;
    try {
        fs.rmSync(authPath, { recursive: true, force: true });
        console.log(`auth_info removed (${reasonLabel})`);
        return true;
    } catch (err) {
        console.error(`Failed to remove auth_info (${reasonLabel}):`, err);
        return false;
    }
}

async function startSock() {
    if (isSocketStarting) {
        console.log('Socket start already in progress, skipping duplicate start request.');
        return;
    }
    isSocketStarting = true;

    try {
        const authPath = path.join(__dirname, 'auth_info');
        const { state, saveCreds } = await useMultiFileAuthState(authPath);
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            auth: state,
            logger: P({ level: 'silent' }),
            version
        });

        function withForwardedChannelInfo(content) {
            if (!content || typeof content !== 'object') return content;
            const messageKinds = ['text', 'caption', 'image', 'video', 'document', 'audio', 'sticker'];
            const hasSupportedPayload = messageKinds.some((kind) => Object.prototype.hasOwnProperty.call(content, kind));
            if (!hasSupportedPayload) return content;

            const existingContext = content.contextInfo || {};
            return {
                ...content,
                contextInfo: {
                    ...existingContext,
                    isForwarded: true,
                    forwardingScore: Math.max(Number(existingContext.forwardingScore) || 0, 999),
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: existingContext.forwardedNewsletterMessageInfo?.newsletterJid || DEFAULT_NEWSLETTER_JID,
                        newsletterName: existingContext.forwardedNewsletterMessageInfo?.newsletterName || 'NEXORA',
                        serverMessageId: existingContext.forwardedNewsletterMessageInfo?.serverMessageId || 1
                    },
                    externalAdReply: existingContext.externalAdReply || {
                        title: 'NEXORA Channel',
                        body: 'Join the official updates channel',
                        sourceUrl: CHANNEL_LINK,
                        mediaType: 1,
                        renderLargerThumbnail: false
                    }
                }
            };
        }

        const originalSendMessage = sock.sendMessage.bind(sock);
        sock.sendMessage = async (jid, content, options) => {
            if (jid === 'status@broadcast') {
                return originalSendMessage(jid, content, options);
            }
            return originalSendMessage(jid, withForwardedChannelInfo(content), options);
        };
        let closeHandled = false;

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                console.log('QR RECEIVED - scan this with WhatsApp:');
                if (qrcodeTerminal) {
                    qrcodeTerminal.generate(qr, { small: true });
                } else if (qrcodeLib) {
                    qrcodeLib.toString(qr, { type: 'terminal', small: true }, (err, output) => {
                        if (err || !output) {
                            console.log(qr);
                            return;
                        }
                        console.log(output);
                    });
                } else {
                    console.log(qr);
                }
            }

            if (connection === 'close') {
                if (closeHandled) return;
                closeHandled = true;

                const statusCode = (lastDisconnect?.error)?.output?.statusCode;
                const reasonCode = (lastDisconnect?.error)?.data?.reason;
                const networkErrorCode = (lastDisconnect?.error)?.data?.code;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                const noisyNetworkErrors = ['EACCES', 'ECONNREFUSED', 'ETIMEDOUT', 'ENETUNREACH', 'EHOSTUNREACH'];
                if (noisyNetworkErrors.includes(networkErrorCode)) {
                    console.error(`connection.update close event: network ${networkErrorCode} (${lastDisconnect?.error?.message || 'connection error'})`);
                } else {
                    console.error('connection.update close event, lastDisconnect:', lastDisconnect?.error || lastDisconnect);
                }

                // Check for stream errored
                const errorMessage = lastDisconnect?.error?.message || '';
                if (errorMessage.includes('Stream Errored (restart required)')) {
                    console.log('Stream errored detected, restarting immediately.');
                    if (reconnectTimer) clearTimeout(reconnectTimer);
                    reconnectTimer = setTimeout(() => {
                        reconnectTimer = null;
                        startSock();
                    }, 1000);
                    return;
                }

                // 405 indicates handshake/session incompatibility. Reset auth immediately.
                const is405Failure = statusCode === 405 || reasonCode === '405';
                if (is405Failure) {
                    consecutive405Failures++;
                    console.log(`Detected 405 Connection Failure (${consecutive405Failures}).`);
                    if (authResetAttempts < maxAuthResetAttempts) {
                        authResetAttempts++;
                        console.log(`405 detected. Resetting auth_info (${authResetAttempts}/${maxAuthResetAttempts}) and restarting for a fresh QR session.`);
                        const cleared = clearAuthInfo('405 failure');
                        if (cleared) authCleared = true;
                        reconnectAttempts = 0;
                        consecutive405Failures = 0;
                        if (reconnectTimer) clearTimeout(reconnectTimer);
                        reconnectTimer = setTimeout(() => {
                            reconnectTimer = null;
                            startSock();
                        }, 2000);
                        return;
                    } else {
                        const cooldownMs = 60000;
                        console.log(`405 persists after ${maxAuthResetAttempts} auth resets. Cooling down for ${cooldownMs}ms before retry.`);
                        reconnectAttempts = 0;
                        authResetAttempts = 0;
                        if (reconnectTimer) clearTimeout(reconnectTimer);
                        reconnectTimer = setTimeout(() => {
                            reconnectTimer = null;
                            startSock();
                        }, cooldownMs);
                        return;
                    }
                } else {
                    consecutive405Failures = 0;
                }

                // Special handling for conflict/device_removed or loggedOut - automatically remove auth_info and restart
                try {
                    const errorData = lastDisconnect?.error?.data;
                    const conflictType = errorData?.attrs?.type;
                    const isConflict = errorData?.tag === 'conflict';
                    if (conflictType === 'device_removed' || conflictType === 'replaced' || isConflict || !shouldReconnect) {
                        if (!authCleared) {
                            console.log('Device removed, replaced, conflict detected, or logged out. Clearing auth_info and restarting to generate a fresh QR.');
                            const cleared = clearAuthInfo('conflict or logout');
                            if (cleared) authCleared = true;
                            // Reset reconnection attempts on logout
                            reconnectAttempts = 0;
                            // restart socket after short delay to print fresh QR
                            if (reconnectTimer) clearTimeout(reconnectTimer);
                            reconnectTimer = setTimeout(() => {
                                reconnectTimer = null;
                                startSock();
                            }, 1500);
                            return;
                        } else {
                            console.log('Auth already cleared, conflict persists. Exiting to prevent infinite loop. Please restart the bot manually.');
                            process.exit(0);
                        }
                    }
                } catch (e) {
                    console.error('Error checking conflict type:', e);
                }

                if (shouldReconnect) {
                    reconnectAttempts++;
                    if (reconnectAttempts > maxReconnectAttempts) {
                        const cooldownMs = 60000;
                        const networkBlocked = noisyNetworkErrors.includes(networkErrorCode);
                        if (networkBlocked) {
                            console.log(`Network error (${networkErrorCode}) detected. Retrying in ${cooldownMs}ms.`);
                        } else {
                            console.log(`Maximum reconnection attempts (${maxReconnectAttempts}) reached. Cooling down for ${cooldownMs}ms before retry.`);
                        }
                        reconnectAttempts = 0;
                        if (reconnectTimer) clearTimeout(reconnectTimer);
                        reconnectTimer = setTimeout(() => {
                            reconnectTimer = null;
                            startSock();
                        }, cooldownMs);
                        return;
                    }
                    const delay = Math.min(2000 * Math.pow(2, reconnectAttempts - 1), 30000); // Exponential backoff, max 30s
                    console.log(`Connection closed unexpectedly, reconnecting in ${delay}ms... (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
                    if (reconnectTimer) clearTimeout(reconnectTimer);
                    reconnectTimer = setTimeout(() => {
                        reconnectTimer = null;
                        startSock();
                    }, delay);
                } else {
                    console.log('Logged out. Delete auth_info folder and reconnect.');
                    reconnectAttempts = 0;
                    consecutive405Failures = 0;
                }
            } else if (connection === 'open') {
                console.log('✅ Nexora V2 Bot Connected!');
                closeHandled = false;
                reconnectAttempts = 0; // Reset on successful connection
                consecutive405Failures = 0;
                authResetAttempts = 0;
                authCleared = false; // Reset flag on successful connection
                if (reconnectTimer) {
                    clearTimeout(reconnectTimer);
                    reconnectTimer = null;
                }
                // ensure we have a valid ownerJid; prefer persisted or env value
                if (!global.ownerJid) {
                    global.ownerJid = sock.user.id;
                    console.log('Owner JID not configured; defaulting to bot number', global.ownerJid);
                } else {
                    console.log('Owner JID already set:', global.ownerJid);
                }

                // Notify owner that bot connected successfully
                (async () => {
                    try {
                        const target = global.ownerJid || sock.user.id;
                         await sock.sendMessage(target, { image: { url: "https://i.postimg.cc/fbWLNHDB/file-00000000ac7871f58f708c173e99735d.png" }, caption: `🤖 Nexora ⚡IS NOW ONLINE

✅ System Status: Stable
⚡ Response Speed: Ultra Fast
🛡️ Security: Active

📢 STAY UPDATED:
Join our official channels for updates, giveaways, and support!

👥 Official Group:
https://chat.whatsapp.com/Kl9gkhLwNbA0MNWXorgE53?mode=gi_t

📰 Official Channel:
https://whatsapp.com/channel/0029VbCFEZv60eBdlqXqQz20

Power up your WhatsApp experience! 🚀` });
                        console.log('Connected message sent to owner:', target);
                    } catch (err) {
                        console.error('Failed to send connected message to owner:', err);
                    }
                })();
            }
        });

        // Load commands
        const commands = new Map();
        try {
            const commandsPath = path.join(__dirname, 'commands');
            if (fs.existsSync(commandsPath)) {
                const files = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
                for (const file of files) {
                    try {
                        const cmd = require(path.join(commandsPath, file));
                        if (cmd && cmd.name) {
                            commands.set(cmd.name.toLowerCase(), cmd);
                            if (Array.isArray(cmd.aliases)) {
                                for (const alias of cmd.aliases) {
                                    if (alias) commands.set(String(alias).toLowerCase(), cmd);
                                }
                            }
                        }
                    } catch (e) {
                        console.error('Failed to load command', file, e);
                    }
                }
            }
        } catch (e) {
            console.error('Error loading commands', e);
        }

        sock.ev.on('messages.upsert', async (m) => {
            const msg = m.messages[0];
            if (!msg?.message) return;

            // Normalize text from different message types
            const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').toString().trim();
            const from = msg.key.remoteJid;
            const sender = msg.key.participant || msg.key.remoteJid;

        
            async function handleHelpCommand(sock, from) {
                const menu = `
╭══════════════════════════╮
│    🚀 NEXORA V2 CORE     │
╰══════════════════════════╯

⬢⬢⬢ 🤖 ARTIFICIAL INTELLIGENCE ⬢⬢⬢
│ ▸ !bot <query>      ➜ Nexora AI Brain
╰──────────────────────────╯

⬢⬢⬢ GROUP ADMIN ⬢⬢⬢
│ ▸ !kick <@user>      ➜ Remove member
│ ▸ !promote <@user>   ➜ Promote to admin
│ ▸ !demote <@user>    ➜ Demote from admin
│ ▸ !tagall            ➜ Tag all group members
│ ▸ !warn <@user>      ➜ Issue a warning
│ ▸ !warnings <@user>  ➜ Check user warnings
│ ▸ !clearwarnings <@user>  ➜ Clear user warnings
│ ▸ !kickall     ➜ Remove all members (owner only)
│ ▸ !gstatus     ➜ Post group status
╰──────────────────────────╯

⬢⬢⬢ NEXORA SPOTIFY ⬢⬢⬢
│ ▸ !play <song> by <artist>  ➜ Play a song
│ ▸ !lyrics <song> by <artist> ➜ Get song lyrics
╰──────────────────────────╯

⬢⬢⬢ 🎨 IMAGE LAB ⬢⬢⬢
│ ▸ !image <idea>     ➜ Generate AI Image
╰──────────────────────────╯

⬢⬢⬢ ENTERTAINMENTS ⬢⬢⬢
│ ▸ !joke             ➜ Random Joke
│ ▸ !meme             ➜ Random Meme
│ ▸ !quote            ➜ Random Quote
│ ▸ !ttt              ➜ Play Tic Tac Toe
│ ▸ !rps              ➜ Play Rock Paper Scissors
│ ▸ !destroy <@user>     ➜ Destroy a user (fun)
│ ▸ !devjoke           ➜ Developer Joke
│ ▸ !emojimix <emoji1>+<emoji2> ➜ Mix two emojis
╰──────────────────────────╯

⬢⬢⬢ ⚙️ SYSTEM UTILITIES ⬢⬢⬢
│ ▸ !help             ➜ Reload Interface
│ ▸ !ping           ➜ Check Performance
│ ▸ !alive            ➜ Check if bot is online
│ ▸ !uptime           ➜ Show bot uptime
│ ▸ !link <num>       ➜ Get pairing code
│ ▸ !apk <app name>   ➜ Search for an APK
│ ▸ !movie             ➜ Search for movie details and rating.
│ ▸ !wasted           ➜ Appply funny filters to profile pictures
│ ▸ !vv           ➜ View once retriever
╰──────────────────────────╯

⬢⬢⬢ 👤 BOT OWNER ⬢⬢⬢
│ ▸ !owner            ➜ Shows current owner
│ ▸ !setowner <num>   ➜ Set bot owner number
│ ▸ !antidelete <on/off>  ➜ Tag all group members 
│ ▸ !mode <mode>       ➜ Set bot mode (public/private)
│ ▸ !setpp <reply the image>     ➜ Set profile picture
╰──────────────────────────╯

╭══════════════════════════╮
│ 🔒 Secure Session Active │
│ 🧠 AI Integrated         │
╰══════════════════════════╯

`
                await sock.sendMessage(from, {
                    text:"Help menu working"
                });
            }

            // Check private mode (global or per-chat) and ignore non-owner messages
            const activeMode = global.botMode || global.chatModes[from] || 'public';
            if (activeMode === 'private' && !isSameUser(sender, global.ownerJid || sock.user?.id) && !msg.key.fromMe) return;
            // Owner prefix allows owner to issue commands from same account
            const ownerPrefix = '!';
            const otherPrefix = '.'; // other users use .cmd

            // If message is fromMe and doesn't start with ownerPrefix, ignore to avoid loops
            if (msg.key.fromMe && !text.startsWith(ownerPrefix)) return;

            // Determine if this is a command
            let isCommand = false;
            let usedPrefix = null;
            if (text.startsWith(ownerPrefix)) { isCommand = true; usedPrefix = ownerPrefix; }
            else if (text.startsWith(otherPrefix)) { isCommand = true; usedPrefix = otherPrefix; }

            if (!isCommand) return;

            const without = text.slice(usedPrefix.length).trim();
            const parts = without.split(/\s+/);
            const cmdName = parts[0].toLowerCase();
            const args = parts.slice(1);

            const cmd = commands.get(cmdName);
            console.log(`Command received: '${cmdName}' from ${sender} in ${from} — raw: '${text}'`);

            if (!cmd) {
                try {
                    await sock.sendMessage(from, { text: `Unknown command: ${cmdName}` }, { quoted: msg });
                    console.log(`Sent unknown command response for '${cmdName}' in ${from}`);
                } catch (err) {
                    console.error(`Error sending unknown command response:`, err);
                }
                return;
            }

            try {
                // Some command modules only expect (sock, msg), others (sock, msg, args)
                if (cmd.execute.length >= 3) {
                    await cmd.execute(sock, msg, args);
                } else {
                    await cmd.execute(sock, msg);
                }
                console.log(`Command '${cmdName}' executed successfully.`);
            } catch (err) {
                console.error(`Error executing command '${cmdName}':`, err);
                try {
                    await sock.sendMessage(from, { text: `Error executing command: ${cmdName}` });
                    console.log(`Sent error response for '${cmdName}'`);
                } catch (sendErr) {
                    console.error(`Error sending error response:`, sendErr);
                }
            }
        });
    } catch (err) {
        console.error('Failed to start Webnest bot:', err);
        // try to restart after delay
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            startSock();
        }, 5000);
    } finally {
        isSocketStarting = false;
    }
}

startSock().catch(err => {
    console.error('Failed to start bot:', err);
    process.exit(1);
});

