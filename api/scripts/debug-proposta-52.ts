import fs from "fs";
import path from "path";
import prisma from "../src/prisma";
import { gerarHtmlProposta } from "../src/services/propostaHtml.service";
import { gerarPdfProposta } from "../src/services/propostaPdf.service";

async function main() {
  const proposta = await prisma.proposta.findUnique({
    where: { propostaid: 52 },
    include: {
      cliente: true,
      itens: { include: { servico: true } },
      templateProposta: true,
    },
  });

  if (!proposta) {
    console.log("proposta 52 not found");
    process.exit(1);
  }

  const html = await gerarHtmlProposta({
    proposta,
    cliente: proposta.cliente,
    itens: proposta.itens,
    template: proposta.templateProposta,
  });

  const outDir = path.join(process.cwd(), "public", "debug");
  fs.mkdirSync(outDir, { recursive: true });
  const htmlPath = path.join(outDir, "proposta-52.html");
  fs.writeFileSync(htmlPath, html, "utf8");

  const pdf = await gerarPdfProposta(html, "proposta-52-debug.pdf");
  console.log("html:", htmlPath);
  console.log("pdf:", pdf.caminho);
  console.log(
    "paragrafo-titulo count:",
    (html.match(/paragrafo-titulo/g) || []).length,
  );
  const obsBlock = html.split("Observações Sistema")[1]?.slice(0, 2500) || "";
  console.log("obs has paragrafo-texto:", obsBlock.includes("paragrafo-texto"));
  console.log("obs p count:", (obsBlock.match(/<p/g) || []).length);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
