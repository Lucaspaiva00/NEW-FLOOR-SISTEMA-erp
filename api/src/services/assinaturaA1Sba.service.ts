import { createDecipheriv, createSign, createVerify, hkdfSync, randomBytes } from "node:crypto";
import forge from "node-forge";
import { validarCertificadoA1Sba } from "./certificadoA1Sba.service";

/**
 * Exclusivo SBA. Reaproveita o envelope AES-256-GCM do upload atual.
 * Material privado nunca pode ser serializado em JSON, logado ou enviado ao navegador.
 *
 * Este teste prova a capacidade criptográfica de assinar com o A1 armazenado.
 * NÃO substitui assinatura XMLDSig, validação XSD ou autorização na SEFIN.
 */
export function testarAssinaturaA1ArmazenadoSba(
  envelopeCriptografado: string,
  empresaId: number,
  empresaFiscalId: number,
): { assinaturaTestada: true; certificadoValidoAte: string; identidadeFiscalConferida: false } {
  if (!Number.isSafeInteger(empresaId) || empresaId <= 0 ||
      !Number.isSafeInteger(empresaFiscalId) || empresaFiscalId <= 0) {
    throw new Error("Identificação fiscal inválida.");
  }
  if (!envelopeCriptografado || envelopeCriptografado.length > 2_500_000) {
    throw new Error("Certificado A1 não cadastrado ou envelope inválido.");
  }
  const segredo = process.env.CERTIFICADO_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!segredo) throw new Error("Chave de criptografia do certificado não configurada no servidor.");
  let pacote: any;
  try {
    pacote = JSON.parse(envelopeCriptografado);
    if (pacote.v !== 1 || ![pacote.iv, pacote.tag, pacote.data].every((v:unknown)=>typeof v==="string")) {
      throw new Error("Formato não suportado");
    }
    const chave = Buffer.from(hkdfSync("sha256", segredo, "sba-certificado-a1", "fiscal-v1", 32));
    const decifrador = createDecipheriv("aes-256-gcm", chave, Buffer.from(pacote.iv, "base64"));
    decifrador.setAAD(Buffer.from(empresaId + ":" + empresaFiscalId));
    decifrador.setAuthTag(Buffer.from(pacote.tag, "base64"));
    const conteudo = Buffer.concat([decifrador.update(Buffer.from(pacote.data, "base64")), decifrador.final()]);
    pacote = JSON.parse(conteudo.toString("utf8"));
    conteudo.fill(0);
  } catch {
    throw new Error("Não foi possível descriptografar o A1. Verifique a chave do servidor e o vínculo com a empresa fiscal.");
  }
  // O mesmo parser/validador do cadastro verifica senha, validade e par de chaves.
  const buffer = validarCertificadoA1Sba(pacote.arquivo, pacote.senha);
  let p12: any;
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(buffer.toString("binary")), pacote.senha);
  } finally {
    buffer.fill(0);
    pacote = null;
  }
  const bags = (oid:string):any[] => p12.getBags({bagType:oid})[oid] || [];
  const certificados = bags(forge.pki.oids.certBag).map(b=>b.cert).filter(Boolean);
  const chaves = [...bags(forge.pki.oids.pkcs8ShroudedKeyBag), ...bags(forge.pki.oids.keyBag)]
    .map(b=>b.key).filter(Boolean);
  const pares: { chave:any, certificado:any }[] = [];
  for (const cert of certificados) for (const chave of chaves) {
    if (chave.n && chave.e && cert.publicKey?.n && cert.publicKey?.e &&
        chave.n.toString(16)===cert.publicKey.n.toString(16) &&
        chave.e.toString(16)===cert.publicKey.e.toString(16) &&
        cert.validity.notBefore<=new Date() && cert.validity.notAfter>new Date()) {
      pares.push({chave,certificado:cert});
    }
  }
  if (!pares.length) throw new Error("Não existe par de chave e certificado vigente para assinar a DPS.");
  const selecionado=pares[0];
  const privada=forge.pki.privateKeyToPem(selecionado.chave);
  const publica=forge.pki.certificateToPem(selecionado.certificado);
  // Assinatura efêmera de diagnóstico; NÃO é uma DPS, e nunca sai do servidor.
  const desafio=randomBytes(32);
  const assinador=createSign("RSA-SHA256");
  assinador.update(desafio);
  assinador.end();
  const assinatura=assinador.sign(privada);
  const verificador=createVerify("RSA-SHA256");
  verificador.update(desafio);
  verificador.end();
  if (!verificador.verify(publica,assinatura)) {
    throw new Error("Falha na verificação local do par de chaves do A1.");
  }
  return {
    assinaturaTestada: true,
    certificadoValidoAte: selecionado.certificado.validity.notAfter.toISOString().slice(0,10),
    // Não confundir validação criptográfica com checagem do CNPJ titular ou ICP-Brasil.
    identidadeFiscalConferida: false,
  };
}
