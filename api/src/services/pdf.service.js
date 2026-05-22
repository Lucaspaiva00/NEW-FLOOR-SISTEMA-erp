const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

exports.gerarPDF = async (html, nomeArquivo) => {
    const pasta = path.resolve(__dirname, "../../public/pdfs");

    if (!fs.existsSync(pasta)) {
        fs.mkdirSync(pasta, { recursive: true });
    }

    const caminho = path.join(pasta, nomeArquivo);

    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();

    await page.setContent(html, {
        waitUntil: "networkidle0"
    });

    await page.pdf({
        path: caminho,
        format: "A4",
        printBackground: true,
        margin: {
            top: "12mm",
            right: "12mm",
            bottom: "12mm",
            left: "12mm"
        }
    });

    await browser.close();

    return {
        caminho,
        url: `/pdfs/${nomeArquivo}`
    };
};