const crypto = require('crypto');
const { PassThrough } = require('stream');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const {
    generateWAMessageContent,
    generateWAMessageFromContent,
    downloadContentFromMessage
} = require('@whiskeysockets/baileys');

if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath);
}

const PURPLE_COLOR = '#9C27B0';

module.exports = {
    name: 'gstatus',
    aliases: ['groupstatus', 'togstatus', 'swgc', 'gs', 'gst'],
    description: 'Post replied media or text as WhatsApp group status.',

    async execute(sock, msg, args = []) {
        const from = msg.key.remoteJid;
        const reply = async (text) => sock.sendMessage(from, { text }, { quoted: msg });

        try {
            if (!from || !from.endsWith('@g.us')) {
                await reply('This command can only be used in groups.');
                return;
            }

            const caption = args.join(' ').trim();
            const contextInfo = getContextInfo(msg);
            const quotedMessage = contextInfo?.quotedMessage || null;
            const hasQuoted = Boolean(quotedMessage);

            if (!hasQuoted) {
                if (!caption) {
                    await reply(
                        'Usage:\n' +
                        '- Reply to image/video/audio with !gstatus [optional caption]\n' +
                        '- Or send text status only: !gstatus your text'
                    );
                    return;
                }

                await groupStatus(sock, from, {
                    text: caption,
                    backgroundColor: PURPLE_COLOR
                });
                await reply('Text group status posted.');
                return;
            }

            const mtype = Object.keys(quotedMessage)[0] || '';

            if (/image|sticker/i.test(mtype)) {
                const mediaType = /sticker/i.test(mtype) ? 'sticker' : 'image';
                const buf = await downloadMedia(quotedMessage, mediaType);
                await groupStatus(sock, from, {
                    image: buf,
                    caption: caption || ''
                });
                await reply('Image group status posted.');
                return;
            }

            if (/video/i.test(mtype)) {
                const buf = await downloadMedia(quotedMessage, 'video');
                await groupStatus(sock, from, {
                    video: buf,
                    caption: caption || ''
                });
                await reply('Video group status posted.');
                return;
            }

            if (/audio/i.test(mtype)) {
                const buf = await downloadMedia(quotedMessage, 'audio');
                let voiceBuffer = buf;
                try {
                    voiceBuffer = await toVN(buf);
                } catch (_) {
                    // fallback to original audio buffer
                }

                let waveform;
                try {
                    waveform = await generateWaveform(buf);
                } catch (_) {
                    waveform = undefined;
                }

                await groupStatus(sock, from, {
                    audio: voiceBuffer,
                    mimetype: 'audio/ogg; codecs=opus',
                    ptt: true,
                    waveform
                });
                await reply('Audio group status posted.');
                return;
            }

            const quotedText =
                quotedMessage.conversation ||
                quotedMessage.extendedTextMessage?.text ||
                quotedMessage.imageMessage?.caption ||
                quotedMessage.videoMessage?.caption ||
                '';

            const textContent = (quotedText || '').trim() || caption;
            if (textContent) {
                await groupStatus(sock, from, {
                    text: textContent,
                    backgroundColor: PURPLE_COLOR
                });
                await reply('Text group status posted.');
                return;
            }

            await reply('Unsupported media type. Reply to an image, video, audio, or text.');
        } catch (err) {
            console.error('groupstatus command error:', err?.message || err);
            await reply(`Failed to post group status: ${err?.message || err}`);
        }
    }
};

function getContextInfo(msg) {
    const message = msg?.message || {};
    const key = Object.keys(message)[0];
    if (!key) return null;
    return message[key]?.contextInfo || null;
}

async function downloadMedia(message, type) {
    const mediaMessage = message[`${type}Message`] || message;
    const stream = await downloadContentFromMessage(mediaMessage, type);
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}

async function groupStatus(sock, jid, content) {
    const { backgroundColor } = content;
    delete content.backgroundColor;

    const inside = await generateWAMessageContent(content, {
        upload: sock.waUploadToServer,
        backgroundColor: backgroundColor || PURPLE_COLOR
    });

    const secret = crypto.randomBytes(32);
    const generated = generateWAMessageFromContent(
        jid,
        {
            messageContextInfo: { messageSecret: secret },
            groupStatusMessageV2: {
                message: {
                    ...inside,
                    messageContextInfo: { messageSecret: secret }
                }
            }
        },
        {}
    );

    await sock.relayMessage(jid, generated.message, { messageId: generated.key.id });
    return generated;
}

function toVN(buffer) {
    return new Promise((resolve, reject) => {
        const input = new PassThrough();
        const output = new PassThrough();
        const chunks = [];

        input.end(buffer);

        ffmpeg(input)
            .noVideo()
            .audioCodec('libopus')
            .format('ogg')
            .audioChannels(1)
            .audioFrequency(48000)
            .on('error', reject)
            .on('end', () => resolve(Buffer.concat(chunks)))
            .pipe(output);

        output.on('data', (chunk) => chunks.push(chunk));
    });
}

function generateWaveform(buffer, bars = 64) {
    return new Promise((resolve, reject) => {
        const input = new PassThrough();
        input.end(buffer);

        const chunks = [];
        ffmpeg(input)
            .audioChannels(1)
            .audioFrequency(16000)
            .format('s16le')
            .on('error', reject)
            .on('end', () => {
                const raw = Buffer.concat(chunks);
                const samples = Math.floor(raw.length / 2);
                const amps = [];

                for (let i = 0; i < samples; i++) {
                    amps.push(Math.abs(raw.readInt16LE(i * 2)) / 32768);
                }

                const size = Math.floor(amps.length / bars);
                if (size <= 0) {
                    resolve(undefined);
                    return;
                }

                const avg = Array.from({ length: bars }, (_, i) => {
                    const slice = amps.slice(i * size, (i + 1) * size);
                    if (!slice.length) return 0;
                    return slice.reduce((a, b) => a + b, 0) / slice.length;
                });

                const max = Math.max(...avg);
                if (!max) {
                    resolve(undefined);
                    return;
                }

                resolve(
                    Buffer.from(avg.map((v) => Math.floor((v / max) * 100))).toString('base64')
                );
            })
            .pipe()
            .on('data', (chunk) => chunks.push(chunk));
    });
}
