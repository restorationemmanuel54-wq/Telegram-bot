function formatMessage(title, body) {
    const cleanBody = String(body || '').trim();
    return `*${title}*\n${cleanBody}`.trim();
}

module.exports = { formatMessage };
