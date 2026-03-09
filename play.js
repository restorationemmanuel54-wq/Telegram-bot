const fs = require('fs')
const path = require('path')
const axios = require('axios')
const { exec } = require('child_process')
const util = require('util')

const execPromise = util.promisify(exec)
const CHANNEL_LINK = 'https://whatsapp.com/channel/0029VbCFEZv60eBdlqXqQz20'
const CHANNEL_CODE = '0029VbCFEZv60eBdlqXqQz20'

function playContext(title, body, sourceUrl, thumbnailUrl) {
    const newsletterJid = process.env.NEWSLETTER_JID || `${CHANNEL_CODE}@newsletter`
    return {
        isForwarded: true,
        forwardingScore: 999,
        forwardedNewsletterMessageInfo: {
            newsletterJid,
            newsletterName: 'NEXORA',
            serverMessageId: 1
        },
        externalAdReply: {
            title: title || 'NEXORA Music',
            body: body || 'Now Playing',
            sourceUrl: sourceUrl || CHANNEL_LINK,
            thumbnailUrl: thumbnailUrl || undefined,
            mediaType: 1,
            renderLargerThumbnail: false
        }
    }
}

module.exports = {
    name: 'play',
    aliases: ['ytmp3', 'ytmp4'],

    async execute(sock, m, args = []) {
        const from = m.key.remoteJid
        const text = (m.message?.conversation || m.message?.extendedTextMessage?.text || '').toString().trim()
        const command = text.replace(/^([!.])/, '').split(/\s+/)[0].toLowerCase()
        const reply = (msg) => sock.sendMessage(from, { text: msg }, { quoted: m })

        if (command === 'play') {
            const raw = args.join(' ').trim()
            if (!raw) {
                await sock.sendMessage(from, {
                    text: 'Usage: !play <song> by <artist>',
                    contextInfo: playContext('PLAY Usage', 'NEXORA', CHANNEL_LINK)
                }, { quoted: m })
                return
            }

            const match = raw.match(/^(.+?)\s+by\s+(.+)$/i)
            const song = (match ? match[1] : raw).trim()
            const artist = (match ? match[2] : '').trim()

            await sock.sendMessage(from, {
                text: `Searching for: ${song}${artist ? ` by ${artist}` : ''}`,
                contextInfo: playContext(song, artist || 'Searching...', CHANNEL_LINK)
            }, { quoted: m })

            try {
                const query = `${song}${artist ? ` ${artist}` : ''}`.trim()
                const { data } = await axios.get('https://itunes.apple.com/search', {
                    params: {
                        term: query,
                        media: 'music',
                        entity: 'song',
                        country: 'US',
                        limit: 1
                    },
                    timeout: 20000
                })

                const track = data?.results?.[0]
                if (!track || !track.previewUrl) {
                    await sock.sendMessage(from, {
                        text: `No audio preview found for: ${query}`,
                        contextInfo: playContext('No Result', query, CHANNEL_LINK)
                    }, { quoted: m })
                    return
                }

                const artworkUrl = (track.artworkUrl100 || track.artworkUrl60 || track.artworkUrl30 || '')
                    .replace('100x100bb.jpg', '600x600bb.jpg')
                const status = `Downloading: ${track.trackName || song}\nArtist: ${track.artistName || artist || 'Unknown artist'}`
                if (artworkUrl) {
                    await sock.sendMessage(from, {
                        image: { url: artworkUrl },
                        caption: status,
                        contextInfo: playContext(
                            track.trackName || song,
                            track.artistName || artist || 'Unknown artist',
                            track.trackViewUrl || track.collectionViewUrl || CHANNEL_LINK,
                            artworkUrl
                        )
                    }, { quoted: m })
                } else {
                    await sock.sendMessage(from, {
                        text: status,
                        contextInfo: playContext(
                            track.trackName || song,
                            track.artistName || artist || 'Unknown artist',
                            track.trackViewUrl || track.collectionViewUrl || CHANNEL_LINK
                        )
                    }, { quoted: m })
                }

                await new Promise((r) => setTimeout(r, 3000))

                const safeTrackName = String(track.trackName || song).replace(/[\\/:*?"<>|]+/g, '')
                const audioResponse = await axios.get(track.previewUrl, {
                    responseType: 'arraybuffer',
                    timeout: 30000
                })
                await sock.sendMessage(from, {
                    audio: Buffer.from(audioResponse.data),
                    mimetype: 'audio/mpeg',
                    ptt: false,
                    fileName: `${safeTrackName}.mp3`,
                    contextInfo: playContext(
                        track.trackName || song,
                        track.artistName || artist || 'Unknown artist',
                        track.trackViewUrl || track.collectionViewUrl || 'https://music.apple.com',
                        artworkUrl
                    )
                }, { quoted: m })
            } catch (e) {
                await sock.sendMessage(from, {
                    text: `Error: ${e.message}`,
                    contextInfo: playContext('PLAY Error', e.message, CHANNEL_LINK)
                }, { quoted: m })
            }
            return
        }

        if (command === 'ytmp4') {
            const url = args[0]
            if (!url) return

            await sock.sendMessage(from, { react: { text: '?', key: m.key } })
            await reply('? *Downloading your video...*')

            try {
                const { data } = await axios.get('https://apis.davidcyril.name.ng/download/ytmp4', { params: { url } })
                if (!data.success || !data.result?.download_url) throw new Error('Link failed.')

                const { title, quality, download_url } = data.result
                const tempPath = path.join(__dirname, `${Date.now()}.mp4`)
                const writer = fs.createWriteStream(tempPath)
                const response = await axios({
                    url: download_url,
                    method: 'GET',
                    responseType: 'stream',
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                })
                response.data.pipe(writer)
                await new Promise((r, j) => { writer.on('finish', r); writer.on('error', j) })

                const sizeMB = (fs.statSync(tempPath).size / (1024 * 1024)).toFixed(2)
                if (parseFloat(sizeMB) > 90) {
                    await sock.sendMessage(from, {
                        document: { url: tempPath },
                        mimetype: 'video/mp4',
                        fileName: `${title}.mp4`,
                        caption: `?? *${title}*\n?? ${sizeMB} MB`
                    }, { quoted: m })
                } else {
                    await sock.sendMessage(from, {
                        video: { url: tempPath },
                        caption: `?? *${title}*\n?? ${quality || '480p'} | ?? ${sizeMB} MB`
                    }, { quoted: m })
                }

                await sock.sendMessage(from, { react: { text: '?', key: m.key } })
                setTimeout(() => { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath) }, 10000)
            } catch (e) {
                await sock.sendMessage(from, { react: { text: '?', key: m.key } })
                await reply(`?? Error: ${e.message}`)
            }
            return
        }

        if (command === 'ytmp3') {
            const url = args.join(' ')
            if (!url) return

            await sock.sendMessage(from, { react: { text: '?', key: m.key } })
            await reply('? *Downloading your audio...*\n_Extracting MP3 via SILENT TECH Engine!_ ??')

            const timestamp = Date.now()
            const tempVid = path.join(__dirname, `temp_vid_${timestamp}.mp4`)
            const tempAud = path.join(__dirname, `temp_aud_${timestamp}.mp3`)

            try {
                const { data } = await axios.get('https://apis.davidcyril.name.ng/download/ytmp4', {
                    params: { url }
                })

                if (!data.success || !data.result || !data.result.download_url) {
                    throw new Error('Failed to fetch source stream.')
                }

                const { title, download_url, thumbnail } = data.result

                const writer = fs.createWriteStream(tempVid)
                const response = await axios({
                    url: download_url,
                    method: 'GET',
                    responseType: 'stream',
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                })

                response.data.pipe(writer)
                await new Promise((resolve, reject) => {
                    writer.on('finish', resolve)
                    writer.on('error', reject)
                })

                await execPromise(`ffmpeg -i "${tempVid}" -vn -acodec libmp3lame -q:a 2 "${tempAud}"`)

                const sizeBytes = fs.statSync(tempAud).size
                if (sizeBytes < 10000) throw new Error('Audio extraction failed or file is corrupted.')

                const adReply = {
                    title: title || 'YouTube Audio',
                    body: 'âŸ¦ ð“†©ð–¤ NÎžXÃ˜RÎ› ð–¤ð“†ª âŸ§ âš¡',
                    sourceUrl: url,
                    mediaType: 1,
                    renderLargerThumbnail: true
                }
                if (thumbnail) adReply.thumbnailUrl = thumbnail

                await sock.sendMessage(from, {
                    audio: fs.readFileSync(tempAud),
                    mimetype: 'audio/mpeg',
                    ptt: false,
                    contextInfo: { externalAdReply: adReply }
                }, { quoted: m })

                await sock.sendMessage(from, { react: { text: '?', key: m.key } })
            } catch (e) {
                await sock.sendMessage(from, { react: { text: '?', key: m.key } })
                console.error('[YTMP3 FFMPEG ERROR]', e.message)
                await reply(`?? Error: ${e.message}`)
            } finally {
                setTimeout(() => {
                    if (fs.existsSync(tempVid)) { try { fs.unlinkSync(tempVid) } catch (_) {} }
                    if (fs.existsSync(tempAud)) { try { fs.unlinkSync(tempAud) } catch (_) {} }
                }, 10000)
            }
        }
    }
}
