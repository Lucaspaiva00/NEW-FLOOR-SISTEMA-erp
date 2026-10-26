import { readFile, unlink } from "node:fs/promises";
import { gerarPdfProposta } from "../dist/services/propostaPdf.service.js";

// Usa o gerador real compartilhado, sem consultar clientes ou alterar propostas.
const nome = `verificacao-pdf-${process.pid}-${Date.now()}.pdf`;
let resultado;
try {
  resultado = await gerarPdfProposta(
    '<!doctype html><html><body><h1>Verificação do gerador PDF</h1></body></html>',
    nome,
  );
  const arquivo = await readFile(resultado.caminho);
  if (arquivo.subarray(0, 5).toString() !== "%PDF-") {
    throw new Error("Gerador não produziu um PDF válido.");
  }
  console.log("PDF global: Chrome iniciado e PDF gerado com sucesso.");
} finally {
  if (resultado) await unlink(resultado.caminho).catch(() => {});
}
