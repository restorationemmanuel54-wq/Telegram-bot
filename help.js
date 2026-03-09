const fs = require('fs');
const path = require('path');

const CHANNEL_LINK = 'https://whatsapp.com/channel/0029VbCFEZv60eBdlqXqQz20';
const CHANNEL_CODE = '0029VbCFEZv60eBdlqXqQz20';
const LAGOS_TZ = 'Africa/Lagos';

function getUptimeSeconds() {
    if (global.botStartTime && Number.isFinite(global.botStartTime)) {
        return Math.max(0, Math.floor((Date.now() - global.botStartTime) / 1000));
    }
    return Math.max(0, Math.floor(process.uptime()));
}

function getMessageLatencyMs(msg) {
    const ts = Number(msg?.messageTimestamp || 0);
    if (!Number.isFinite(ts) || ts <= 0) return 0;
    const sentAtMs = ts < 1e12 ? Math.floor(ts * 1000) : Math.floor(ts);
    return Math.max(0, Date.now() - sentAtMs);
}

function formatUptime(totalSeconds) {
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
}

function getPluginCount() {
    try {
        const files = fs.readdirSync(__dirname).filter((file) => file.endsWith('.js'));
        let count = 0;
        for (const file of files) {
            try {
                const cmd = require(path.join(__dirname, file));
                if (cmd?.name) count++;
            } catch {
                // ignore broken modules for plugin count accuracy
            }
        }
        return count;
    } catch {
        return 0;
    }
}

function getAllCommands() {
    try {
        const files = fs.readdirSync(__dirname).filter((file) => file.endsWith('.js'));
        const names = new Set();

        for (const file of files) {
            try {
                const cmd = require(path.join(__dirname, file));
                if (cmd?.name) names.add(String(cmd.name).toLowerCase());
                if (Array.isArray(cmd?.aliases)) {
                    for (const alias of cmd.aliases) {
                        if (alias) names.add(String(alias).toLowerCase());
                    }
                }
            } catch {
                const fallback = file.replace(/\.js$/i, '').toLowerCase();
                if (fallback) names.add(fallback);
            }
        }

        return Array.from(names).sort((a, b) => a.localeCompare(b));
    } catch {
        return [];
    }
}

function nowDate() {
    return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: LAGOS_TZ
    }).format(new Date());
}

function nowTime() {
    return new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZone: LAGOS_TZ
    }).format(new Date());
}

module.exports = {
    name: 'help',

    async execute(sock, msg) {
        const from = msg.key.remoteJid;

        const mode = (global.chatModes && global.chatModes[from]) || 'public';
        const user = msg.pushName || 'NEXORA';
        const plugins = getPluginCount();
        const allCommands = getAllCommands();
        const allCommandsSection = allCommands.length
            ? allCommands.map((cmd) => `│ ⌬ !${cmd}`).join('\n')
            : '│ ⌬ (no commands found)';
        const uptime = formatUptime(getUptimeSeconds());
        const ramMb = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
        const ping = getMessageLatencyMs(msg);

        const menu = `╔══════════════════════════════════╗
║        ⟦ 𓆩𖤍 NΞXØRΛ 𖤍𓆪 ⟧        ║
╚══════════════════════════════════╝

┌─〔 SYSTEM STATUS 〕─┐
│ Mode    : ${mode.toUpperCase()}
│ User    : ${user}
│ Plugins : ${plugins}+
│ Uptime  : ${uptime}
│ Date    : ${nowDate()}
│ Time    : ${nowTime()}
│ RAM     : ${ramMb}MB
│ Ping    : ${ping}ms
└────────────────────┘

╭─〔 ⚡ GENERAL 〕─╮
│ ⌬ !help      → Open command menu
│ ⌬ !bot       → Nexora AI chat
╰──────────────╯

╭─〔 📊 GROUP STATUS 〕─╮
│ ⌬ !gstatus   → Post group status
│ ⌬ !gst       → Alias for gstatus
│ ⌬ !groupstatus → Alias for gstatus
│ ⌬ !gs        → Alias for gstatus
╰──────────────────────╯

╭─〔 👑 ADMIN CONTROLS 〕─╮
│ ⌬ !kick      → Remove member
│ ⌬ !kickall   → Remove all members
│ ⌬ !promote   → Promote member
│ ⌬ !demote    → Demote member
│ ⌬ !tagall    → Mention all members
│ ⌬ !warn      → Warn member
│ ⌬ !warnings  → Show warnings
│ ⌬ !clearwarnings → Clear warnings
│ ⌬ !mute      → Mute member
│ ⌬ !unmute    → Unmute member
╰────────────────────────╯

╭─〔 🎵 MEDIA 〕─╮
│ ⌬ !play      → Play Spotify track
│ ⌬ !lyrics    → Get song lyrics
│ ⌬ !yt        → Download YouTube
│ ⌬ !tiktok    → Download TikTok
│ ⌬ !instagram → Download Instagram media
╰──────────────╯

╭─〔 🎭 FUN 〕─╮
│ ⌬ !joke      → Random joke
│ ⌬ !meme      → Random meme
│ ⌬ !quote     → Random quote
│ ⌬ !ttt       → Tic Tac Toe
│ ⌬ !rps       → Rock Paper Scissors
│ ⌬ !destroy   → Fun destroy command
│ ⌬ !devjoke   → Developer joke
│ ⌬ !emojimix  → Mix two emojis
│ ⌬ !wasted    → Apply wasted filter
╰──────────────╯

╭─〔 🧠 TOOLS 〕─╮
│ ⌬ !img       → Generate AI image
│ ⌬ !image     → Alias for img
│ ⌬ !apk       → APK search
│ ⌬ !movie     → Movie info
│ ⌬ !vv        → View-once retriever
╰──────────────╯

╭─〔 🛠 SYSTEM 〕─╮
│ ⌬ !ping      → Check latency
│ ⌬ !alive     → Bot status
│ ⌬ !uptime    → Show uptime
│ ⌬ !antidelete → Toggle antidelete
│ ⌬ !link      → Get pairing code
╰──────────────╯

╭─〔 👤 OWNER 〕─╮
│ ⌬ !owner     → Show owner
│ ⌬ !setowner  → Set owner number
│ ⌬ !setpp     → Set bot profile photo
│ ⌬ !mode      → Bot public/private mode
╰──────────────╯

╭─〔 All Commands 〕─╮
${allCommandsSection}
╰──────────────╯

> Powered by ⟦ 𓆩𖤍 NΞXØRΛ 𖤍𓆪 ⟧ ⚡`;
        const newsletterJid = process.env.NEWSLETTER_JID || `${CHANNEL_CODE}@newsletter`;

        const contextInfo = {
            isForwarded: true,
            forwardingScore: 999,
            forwardedNewsletterMessageInfo: {
                newsletterJid,
                newsletterName: 'NEXORA',
                serverMessageId: 1
            },
            externalAdReply: {
                title: 'NEXORA Channel',
                body: 'Join the official updates channel',
                sourceUrl: CHANNEL_LINK,
                mediaType: 1,
                renderLargerThumbnail: false
            }
        };

        try {
            await sock.sendMessage(
                from,
                {
                    image: { url: 'https://i.postimg.cc/FzwNWQ4g/file-000000005b5072468571f4147581121f.png' },
                    caption: menu,
                    contextInfo
                },
                { quoted: msg }
            );
        } catch (err) {
            console.error('help command image send failed, using text fallback:', err?.message || err);
            await sock.sendMessage(
                from,
                { text: menu, contextInfo },
                { quoted: msg }
            );
        }
    }
};
