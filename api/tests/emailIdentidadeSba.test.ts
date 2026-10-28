import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import nodemailer from "nodemailer";
import { enviarPropostaPorEmail } from "../src/services/propostaEmail.service";
import { templateEmailPropostaComAnexo, templateEmailPropostaMinimo } from "../src/templates/emailLayout";

const identidade = {
  nome: "SBA", rodape: "Serralheria SBA Indústria e Comércio Ltda",
  logoUrl: "https://www.sbaserralheria.com.br/assets/logo.png",
  corPrimaria: "#111827", corSecundaria: "#e5e7eb",
};

for (const falhas of [0, 1, 2]) {
  test(`SBA mantém identidade e não copia New Floor após ${falhas} falhas SMTP`, async (t) => {
    const dir = mkdtempSync(path.join(tmpdir(), "email-sba-"));
    const arquivo = path.join(dir, "proposta.pdf");
    writeFileSync(arquivo, "%PDF-1.4\n teste");
    const anteriores = { user: process.env.SMTP_USER, texto: process.env.EMAIL_SOMENTE_TEXTO };
    process.env.SMTP_USER = "teste@example.invalid";
    delete process.env.EMAIL_SOMENTE_TEXTO;
    const mensagens: any[] = [];
    t.mock.method(nodemailer, "createTransport", () => ({sendMail: async (mail: any) => {
      mensagens.push(mail);
      if (mensagens.length <= falhas) throw new Error("falha simulada");
    }}));
    try {
      const modo = await enviarPropostaPorEmail({
        destinatario: "cliente@example.invalid", clienteNome: "Cliente & Cia", numeroProposta: "659",
        linkDownload: "https://erp.example.invalid/propostas/659/download", caminhoPdf: arquivo,
        nomeArquivoPdf: "proposta.pdf", assunto: "SBA - proposta 659", identidade,
      });
      assert.equal(modo, falhas === 2 ? "link" : "anexo");
      for (const mensagem of mensagens) {
        const conteudo = String(mensagem.html || mensagem.text);
        assert.match(conteudo, /SBA/);
        assert.doesNotMatch(conteudo, /new.?floor|Pisos e Revestimentos/i);
        assert.equal(mensagem.bcc, undefined);
        if (mensagem.html) {
          assert.ok(conteudo.includes(identidade.logoUrl));
          assert.ok(conteudo.includes(identidade.corPrimaria));
          assert.ok(conteudo.includes(identidade.corSecundaria));
        }
      }
    } finally {
      if (anteriores.user === undefined) delete process.env.SMTP_USER; else process.env.SMTP_USER = anteriores.user;
      if (anteriores.texto === undefined) delete process.env.EMAIL_SOMENTE_TEXTO; else process.env.EMAIL_SOMENTE_TEXTO = anteriores.texto;
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

test("New Floor preserva identidade padrão; SBA sem logo usa seu próprio nome", () => {
  const dados = {clienteNome:"Cliente", numeroProposta:"659", linkDownload:"https://example.invalid"};
  assert.match(templateEmailPropostaComAnexo(dados), /Equipe NEW FLOOR/);
  const html = templateEmailPropostaComAnexo({...dados, identidade:{...identidade, logoUrl:null}});
  assert.match(html, /Equipe SBA/);
  assert.doesNotMatch(html, /new.?floor/i);
  assert.doesNotMatch(templateEmailPropostaMinimo({...dados, identidade}), /new.?floor/i);
});
