const fs = require("fs");
const os = require("os");
const path = require("path");

function escapePdfText(text) {
    return String(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildSimplePdf(lines) {
    const textLines = lines.map((line, i) => {
        const y = 780 - i * 16;
        return `BT /F1 11 Tf 40 ${y} Td (${escapePdfText(line)}) Tj ET`;
    }).join("\n");

    const objects = [];
    objects.push("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj");
    objects.push("2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj");
    objects.push("3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj");
    objects.push("4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj");
    objects.push(`5 0 obj << /Length ${Buffer.byteLength(textLines, "utf8")} >> stream\n${textLines}\nendstream endobj`);

    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    for (const obj of objects) {
        offsets.push(Buffer.byteLength(pdf, "utf8"));
        pdf += obj + "\n";
    }

    const xrefStart = Buffer.byteLength(pdf, "utf8");
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += "0000000000 65535 f \n";
    for (let i = 1; i <= objects.length; i++) {
        pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
    }
    pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
    return Buffer.from(pdf, "utf8");
}

module.exports = {
    name: "apk",

    async execute(sock, msg, args = []) {
        const from = msg.key.remoteJid;
        const query = args.join(" ").trim();

        if (!query) {
            await sock.sendMessage(from, {
                text: "Usage: !apk <app name>\nExample: !apk zenith bank"
            }, { quoted: msg });
            return;
        }

        const encoded = encodeURIComponent(query);
        const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        const lines = [
            "NEXORA APK SEARCH REPORT",
            `Query: ${query}`,
            "",
            "Use one of these links to download the app APK:",
            `APKPure Search: https://apkpure.com/search?q=${encoded}`,
            `APKCombo Search: https://apkcombo.com/search/${encoded}/`,
            `Aptoide Search: https://en.aptoide.com/search?query=${encoded}`,
            "",
            "Official app listing (if available):",
            `Google Play Search: https://play.google.com/store/search?q=${encoded}&c=apps`,
            "",
            "Security tip: verify publisher name and app permissions before install."
        ];

        const pdfBuffer = buildSimplePdf(lines);
        const filename = `${slug || "apk-search"}-report.pdf`;
        const tempPath = path.join(os.tmpdir(), filename);

        try {
            fs.writeFileSync(tempPath, pdfBuffer);
            await sock.sendMessage(from, {
                document: { url: tempPath },
                fileName: filename,
                mimetype: "application/pdf",
                caption: `APK search report for "${query}"`
            }, { quoted: msg });
        } catch (error) {
            console.error("APK command error:", error);
            await sock.sendMessage(from, {
                text: "Failed to generate APK PDF report. Try again."
            }, { quoted: msg });
        } finally {
            try {
                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
            } catch (_) {}
        }
    }
};
