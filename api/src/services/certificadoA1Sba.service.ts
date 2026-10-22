import forge from "node-forge";

/**
 * Validação específica da SBA, sem salvar arquivo/senha nem chamar provedores.
 * Todos os dados permanecem no servidor somente durante a requisição.
 */
export function validarCertificadoA1Sba(arquivo: unknown, senha: unknown): Buffer {
  if (typeof arquivo !== "string" || typeof senha !== "string" || !senha.length || senha.length > 1000) {
    throw Error("Selecione o PFX/P12 e informe a senha do certificado A1.");
  }
  if (!arquivo || arquivo.length > 1_400_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(arquivo)) {
    throw Error("Arquivo inválido ou maior que 1 MB. Selecione o PFX/P12 original.");
  }
  const buffer = Buffer.from(arquivo, "base64");
  if (!buffer.length || buffer.length > 1024 * 1024 ||
      buffer.toString("base64").replace(/=+$/, "") !== arquivo.replace(/=+$/, "")) {
    throw Error("O certificado PFX/P12 está vazio, inválido ou excede 1 MB.");
  }

  let asn1: forge.asn1.Asn1;
  try {
    asn1 = forge.asn1.fromDer(buffer.toString("binary"));
  } catch {
    throw Error("O arquivo não é um contêiner PFX/P12 válido. Exporte o A1 novamente com a chave privada.");
  }
  let pfx: any;
  try {
    pfx = forge.pkcs12.pkcs12FromAsn1(asn1, senha);
  } catch {
    // Algumas exportações modernas usam algoritmos PKCS#12 não suportados
    // pelo node-forge. Não afirmar que a senha está errada nesses casos.
    throw Error("Não foi possível abrir o PFX/P12. Confira a senha; se ela estiver correta, exporte novamente o A1 com chave privada em PKCS#12 compatível.");
  }

  const bag = (oid: string): any[] => pfx.getBags({ bagType: oid })[oid] || [];
  const chaves = [...bag(forge.pki.oids.pkcs8ShroudedKeyBag), ...bag(forge.pki.oids.keyBag)]
    .map(item => item.key).filter(Boolean);
  const certificados = bag(forge.pki.oids.certBag).map(item => item.cert).filter(Boolean);
  if (!certificados.length) {
    throw Error("O PFX/P12 não contém um certificado X.509. Exporte o certificado digital A1 completo.");
  }
  if (!chaves.length) {
    throw Error("O PFX/P12 não contém chave privada. Reexporte o certificado A1 marcando a opção de incluir a chave privada; um arquivo só com certificado público não permite assinar notas.");
  }
  const combinacoes = certificados.filter(cert => chaves.some(chave =>
    Boolean(chave.n && chave.e && cert.publicKey?.n && cert.publicKey?.e) &&
    chave.n.toString(16) === cert.publicKey.n.toString(16) &&
    chave.e.toString(16) === cert.publicKey.e.toString(16)));
  if (!combinacoes.length) {
    throw Error("A chave privada não corresponde ao certificado deste PFX/P12. Exporte novamente o par completo, pelo mesmo dispositivo/conta que gerou a chave.");
  }
  const agora = new Date();
  if (combinacoes.every(cert => cert.validity.notBefore > agora)) {
    throw Error("O certificado digital ainda não entrou em vigor. Confira a data de início da validade.");
  }
  if (combinacoes.every(cert => cert.validity.notAfter <= agora)) {
    throw Error("O certificado digital A1 está vencido. É necessário renovar o A1 e exportar um novo arquivo PFX/P12.");
  }
  if (!combinacoes.some(cert => cert.validity.notBefore <= agora && cert.validity.notAfter > agora)) {
    throw Error("Nenhum certificado correspondente à chave privada está dentro do período de validade.");
  }
  return buffer;
}
