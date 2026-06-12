import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

export interface ResultadoPDF {
    caminho: string;
    url: string;
}

export function nomeDownloadPdfProposta(
    numero: string,
    razaoSocial?: string | null
): string {
    const razao = (razaoSocial || "").trim();
    const nome = `Proposta técnica comercial new floor (${numero})${razao ? ` (${razao})` : ""}`;
    return nome.replace(/[\\/:*?"<>|]/g, "").trim() + ".pdf";
}

export async function gerarPdfProposta(
    html: string,
    nomeArquivo: string
): Promise<ResultadoPDF> {

    const pastaDestino = path.join(
        process.cwd(),
        "public",
        "propostas"
    );

    if (!fs.existsSync(pastaDestino)) {

        fs.mkdirSync(
            pastaDestino,
            {
                recursive: true
            }
        );

    }

    const caminhoArquivo = path.join(
        pastaDestino,
        nomeArquivo
    );

    let browser;

    try {

        browser = await puppeteer.launch({
            headless: true,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--no-first-run",
                "--single-process",
                "--no-zygote"
            ]
        });

        const page = await browser.newPage();

        await page.setViewport({
            width: 1440,
            height: 2000
        });

        await page.setContent(
            html,
            {
                waitUntil: "load"
            }
        );

        await page.pdf({
            path: caminhoArquivo,
            format: "A4",
            printBackground: true,
            preferCSSPageSize: true,
            margin: {
                top: "10mm",
                right: "10mm",
                bottom: "10mm",
                left: "10mm"
            }
        });

        return {
            caminho: caminhoArquivo,
            url: `/propostas/${nomeArquivo}`
        };

    } catch (error) {

        console.error(
            "Erro geração PDF:"
        );

        console.error(error);

        throw error;

    } finally {

        if (browser) {

            await browser.close();

        }

    }

}