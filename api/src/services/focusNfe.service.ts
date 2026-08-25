function onlyDigits(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const digits = String(value).replace(/\D/g, "");
  return digits || undefined;
}

function decimal(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function compactObject(value: any): any {
  if (Array.isArray(value)) {
    return value.map(compactObject).filter((item) => item !== undefined);
  }

  if (value && typeof value === "object" && !(value instanceof Date)) {
    const output: Record<string, any> = {};

    for (const [key, item] of Object.entries(value)) {
      const cleaned = compactObject(item);
      if (cleaned !== undefined && cleaned !== null && cleaned !== "") {
        output[key] = cleaned;
      }
    }

    return output;
  }

  if (value === undefined || value === null || value === "") return undefined;
  return value;
}

function deepMerge(base: any, extra: any): any {
  if (!extra || typeof extra !== "object" || Array.isArray(extra)) return base;
  const merged = { ...base };

  for (const [key, value] of Object.entries(extra)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      merged[key] &&
      typeof merged[key] === "object" &&
      !Array.isArray(merged[key])
    ) {
      merged[key] = deepMerge(merged[key], value);
    } else {
      merged[key] = value;
    }
  }

  return merged;
}

function isoWithBrazilOffset(date?: Date | string | null): string {
  const d = date ? new Date(date) : new Date();
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  const utc = d.getTime();
  const brasil = new Date(utc - 3 * 60 * 60 * 1000);
  return brasil.toISOString().replace("Z", "-03:00");
}

function normalizeUrl(baseUrl: string, value: unknown): string | undefined {
  if (!value) return undefined;
  const text = String(value);
  if (/^https?:\/\//i.test(text)) return text;
  if (text.startsWith("/")) return `${baseUrl}${text}`;
  return text;
}

function getBaseUrl(empresa: any): string {
  return empresa.ambiente === "PRODUCAO"
    ? "https://api.focusnfe.com.br"
    : "https://homologacao.focusnfe.com.br";
}

function getToken(empresa: any): string {
  const token =
    empresa.ambiente === "PRODUCAO"
      ? empresa.tokenProducao
      : empresa.tokenHomologacao;

  if (!token) {
    throw new Error(
      `Token da Focus NFe não configurado para o ambiente ${empresa.ambiente === "PRODUCAO" ? "de produção" : "de homologação"}.`,
    );
  }

  return token;
}

function documentPath(nota: any): "nfe" | "nfse" | "nfsen" {
  if (nota.tipo === "NFE") return "nfe";
  return nota.empresaFiscal.padraoNfse === "NACIONAL" ? "nfsen" : "nfse";
}

function codigoOpcaoSimplesNacional(empresa: any): "1" | "2" | "3" {
  if (!empresa.optanteSimplesNacional) return "1";

  // Focus / NFS-e Nacional:
  // 1 = Não optante
  // 2 = MEI
  // 3 = Optante Simples Nacional ME/EPP
  return Number(empresa.regimeTributario) === 4 ? "2" : "3";
}

function codigoTributacaoNacionalIss(nota: any): string | undefined {
  const informado = nota.itemListaServico || nota.empresaFiscal?.itemListaServicoPadrao;
  const digits = onlyDigits(informado);

  if (!digits && onlyDigits(nota.empresaFiscal?.cnpj) === "46429017000160") {
    return "070701";
  }
  if (digits === "707" || digits === "0707") return "070701";

  return digits;
}

function localDestino(nota: any): number {
  const pais = String(nota.destinatarioPais || "Brasil").toUpperCase();
  if (pais !== "BRASIL" && pais !== "BRAZIL") return 3;

  const ufEmitente = String(nota.empresaFiscal.estado || "").toUpperCase();
  const ufDest = String(nota.destinatarioEstado || "").toUpperCase();
  if (!ufEmitente || !ufDest) return 1;
  return ufEmitente === ufDest ? 1 : 2;
}

function buildNfePayload(nota: any): Record<string, any> {
  const empresa = nota.empresaFiscal;
  const homologacao = empresa.ambiente !== "PRODUCAO";

  const items = (nota.itens || []).map((item: any, index: number) => {
    const base = {
      numero_item: index + 1,
      codigo_produto: item.codigo || `ITEM${index + 1}`,
      descricao: item.descricao,
      codigo_ncm: onlyDigits(item.ncm),
      cest: onlyDigits(item.cest),
      cfop: onlyDigits(item.cfop),
      unidade_comercial: item.unidade || "UN",
      quantidade_comercial: decimal(item.quantidade),
      valor_unitario_comercial: decimal(item.valorUnitario),
      valor_bruto: decimal(item.valorBruto),
      valor_desconto: decimal(item.valorDesconto),
      unidade_tributavel: item.unidade || "UN",
      quantidade_tributavel: decimal(item.quantidade),
      valor_unitario_tributavel: decimal(item.valorUnitario),
      icms_origem: item.icmsOrigem,
      icms_situacao_tributaria: item.icmsSituacaoTributaria,
      icms_modalidade_base_calculo: item.icmsModalidadeBaseCalculo,
      icms_base_calculo: decimal(item.icmsBaseCalculo),
      icms_aliquota: decimal(item.icmsAliquota),
      icms_valor: decimal(item.icmsValor),
      pis_situacao_tributaria: item.pisSituacaoTributaria,
      pis_base_calculo: decimal(item.pisBaseCalculo),
      pis_aliquota_porcentual: decimal(item.pisAliquota),
      pis_valor: decimal(item.pisValor),
      cofins_situacao_tributaria: item.cofinsSituacaoTributaria,
      cofins_base_calculo: decimal(item.cofinsBaseCalculo),
      cofins_aliquota_porcentual: decimal(item.cofinsAliquota),
      cofins_valor: decimal(item.cofinsValor),
      informacoes_adicionais: item.informacoesAdicionais,
    };

    return compactObject(deepMerge(base, item.payloadExtra));
  });

  const payload = {
    natureza_operacao: nota.naturezaOperacao || empresa.naturezaOperacaoNfe,
    data_emissao: isoWithBrazilOffset(nota.dataEmissao),
    tipo_documento: 1,
    local_destino: localDestino(nota),
    finalidade_emissao: nota.finalidadeEmissao || 1,
    consumidor_final: nota.consumidorFinal ?? 1,
    presenca_comprador: nota.presencaComprador ?? 9,
    serie: nota.serie || empresa.serieNfe,

    cnpj_emitente: onlyDigits(empresa.cnpj),
    nome_emitente: empresa.razaoSocial,
    nome_fantasia_emitente: empresa.nomeFantasia,
    logradouro_emitente: empresa.endereco,
    numero_emitente: empresa.numero,
    complemento_emitente: empresa.complemento,
    bairro_emitente: empresa.bairro,
    codigo_municipio_emitente: onlyDigits(empresa.codigoMunicipioIbge),
    municipio_emitente: empresa.cidade,
    uf_emitente: empresa.estado,
    cep_emitente: onlyDigits(empresa.cep),
    inscricao_estadual_emitente: onlyDigits(empresa.inscricaoEstadual),
    regime_tributario_emitente: empresa.regimeTributario,

    nome_destinatario: homologacao
      ? "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL"
      : nota.destinatarioNome,
    cnpj_destinatario: onlyDigits(nota.destinatarioCnpj),
    cpf_destinatario: onlyDigits(nota.destinatarioCpf),
    inscricao_estadual_destinatario: onlyDigits(nota.destinatarioIe),
    indicador_inscricao_estadual_destinatario: nota.indicadorIeDestinatario ?? 9,
    email_destinatario: nota.destinatarioEmail,
    telefone_destinatario: onlyDigits(nota.destinatarioTelefone),
    logradouro_destinatario: nota.destinatarioEndereco,
    numero_destinatario: nota.destinatarioNumero,
    complemento_destinatario: nota.destinatarioComplemento,
    bairro_destinatario: nota.destinatarioBairro,
    codigo_municipio_destinatario: onlyDigits(nota.destinatarioCodigoMunicipio),
    municipio_destinatario: nota.destinatarioCidade,
    uf_destinatario: nota.destinatarioEstado,
    cep_destinatario: onlyDigits(nota.destinatarioCep),
    pais_destinatario: nota.destinatarioPais || "Brasil",

    valor_frete: decimal(nota.valorFrete) ?? 0,
    valor_seguro: decimal(nota.valorSeguro) ?? 0,
    valor_desconto: decimal(nota.valorDesconto) ?? 0,
    valor_outras_despesas: decimal(nota.valorOutrasDespesas) ?? 0,
    valor_produtos: decimal(nota.valorProdutos) ?? 0,
    valor_total: decimal(nota.valorTotal) ?? 0,
    modalidade_frete: nota.modalidadeFrete ?? 9,
    informacoes_adicionais_contribuinte:
      nota.informacoesAdicionais || empresa.informacoesAdicionaisPadrao,
    items,
  };

  return compactObject(deepMerge(payload, nota.payloadExtra));
}

function buildNfseMunicipalPayload(nota: any): Record<string, any> {
  const empresa = nota.empresaFiscal;
  const servico = {
    aliquota: decimal(nota.aliquotaIss),
    discriminacao:
      nota.informacoesAdicionais ||
      (nota.itens || []).map((item: any) => item.descricao).join("\n"),
    iss_retido: Boolean(nota.issRetido),
    item_lista_servico: nota.itemListaServico || empresa.itemListaServicoPadrao,
    codigo_tributario_municipio:
      nota.codigoTributarioMunicipal || empresa.codigoTributarioMunicipal,
    codigo_cnae: nota.cnaeServico || empresa.cnae,
    valor_servicos: decimal(nota.valorServicos) ?? decimal(nota.valorTotal),
    valor_deducoes: 0,
    valor_pis: 0,
    valor_cofins: 0,
    valor_inss: 0,
    valor_ir: 0,
    valor_csll: 0,
  };

  const payload = {
    data_emissao: isoWithBrazilOffset(nota.dataEmissao),
    natureza_operacao: nota.naturezaOperacao || empresa.naturezaOperacaoNfse || "1",
    regime_especial_tributacao: empresa.regimeEspecialTributacaoNfse,
    optante_simples_nacional: Boolean(empresa.optanteSimplesNacional),
    incentivador_cultural: Boolean(empresa.incentivadorCultural),
    prestador: {
      cpf_cnpj: { cnpj: onlyDigits(empresa.cnpj) },
      inscricao_municipal: onlyDigits(empresa.inscricaoMunicipal),
      codigo_municipio: onlyDigits(empresa.codigoMunicipioIbge),
    },
    tomador: {
      cpf_cnpj: compactObject({
        cnpj: onlyDigits(nota.destinatarioCnpj),
        cpf: onlyDigits(nota.destinatarioCpf),
      }),
      razao_social: nota.destinatarioNome,
      inscricao_municipal: onlyDigits(nota.destinatarioIm),
      email: nota.destinatarioEmail,
      endereco: {
        logradouro: nota.destinatarioEndereco,
        numero: nota.destinatarioNumero,
        complemento: nota.destinatarioComplemento,
        bairro: nota.destinatarioBairro,
        codigo_municipio: onlyDigits(nota.destinatarioCodigoMunicipio),
        municipio: nota.destinatarioCidade,
        uf: nota.destinatarioEstado,
        cep: onlyDigits(nota.destinatarioCep),
      },
    },
    servico,
    codigo_obra: nota.codigoObra,
    art: nota.art,
  };

  return compactObject(deepMerge(payload, nota.payloadExtra));
}

function buildNfseNacionalPayload(nota: any): Record<string, any> {
  const empresa = nota.empresaFiscal;
  const descricao =
    nota.informacoesAdicionais ||
    (nota.itens || []).map((item: any) => item.descricao).join("\n");

  const payload = {
    data_emissao: isoWithBrazilOffset(nota.dataEmissao),
    data_competencia: isoWithBrazilOffset(nota.dataEmissao).slice(0, 10),
    serie_dps: Number(empresa.serieNfse || 1),
    emitente_dps: "1",

    codigo_municipio_emissora: onlyDigits(empresa.codigoMunicipioIbge),
    cnpj_prestador: onlyDigits(empresa.cnpj),
    inscricao_municipal_prestador: onlyDigits(empresa.inscricaoMunicipal),

    // NFS-e Nacional: 1=não optante, 2=MEI, 3=Simples ME/EPP.
    codigo_opcao_simples_nacional: codigoOpcaoSimplesNacional(empresa),

    // No padrão nacional, 0 significa "Nenhum regime especial".
    regime_especial_tributacao:
      String(empresa.regimeEspecialTributacaoNfse || "0"),

    cnpj_tomador: onlyDigits(nota.destinatarioCnpj),
    cpf_tomador: onlyDigits(nota.destinatarioCpf),
    inscricao_municipal_tomador: onlyDigits(nota.destinatarioIm),
    razao_social_tomador: nota.destinatarioNome,
    codigo_municipio_tomador: onlyDigits(nota.destinatarioCodigoMunicipio),
    cep_tomador: onlyDigits(nota.destinatarioCep),
    logradouro_tomador: nota.destinatarioEndereco,
    numero_tomador: nota.destinatarioNumero,
    complemento_tomador: nota.destinatarioComplemento,
    bairro_tomador: nota.destinatarioBairro,
    telefone_tomador: onlyDigits(nota.destinatarioTelefone),
    email_tomador: nota.destinatarioEmail,

    codigo_municipio_prestacao:
      onlyDigits(nota.destinatarioCodigoMunicipio) ||
      onlyDigits(empresa.codigoMunicipioIbge),

    codigo_tributacao_nacional_iss: codigoTributacaoNacionalIss(nota),
    codigo_tributacao_municipal_iss:
      nota.codigoTributarioMunicipal || empresa.codigoTributarioMunicipal,

    descricao_servico: descricao,
    valor_servico: decimal(nota.valorServicos) ?? decimal(nota.valorTotal),

    // NFS-e Nacional:
    // 1=tributável, 2=imunidade, 3=exportação, 4=não incidência.
    tributacao_iss: Number(
      nota.naturezaOperacao || empresa.naturezaOperacaoNfse || "1",
    ),

    percentual_aliquota_relativa_municipio:
      decimal(nota.aliquotaIss) ?? decimal(empresa.aliquotaIssPadrao),
  };

  return compactObject(deepMerge(payload, nota.payloadExtra));
}

export function buildFocusPayload(nota: any): Record<string, any> {
  if (nota.tipo === "NFE") return buildNfePayload(nota);
  if (nota.empresaFiscal.padraoNfse === "NACIONAL") {
    return buildNfseNacionalPayload(nota);
  }
  return buildNfseMunicipalPayload(nota);
}

async function focusRequest(
  empresa: any,
  path: string,
  method: "GET" | "POST" | "DELETE",
  body?: any,
): Promise<{ statusCode: number; data: any; baseUrl: string }> {
  const baseUrl = getBaseUrl(empresa);
  const token = getToken(empresa);
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${token}:`).toString("base64")}`,
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const raw = await response.text();
  let data: any = raw;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { mensagem: raw };
  }

  if (!response.ok) {
    const message =
      data?.mensagem ||
      data?.message ||
      data?.erro ||
      data?.error ||
      data?.erros?.[0]?.mensagem ||
      `Focus NFe respondeu HTTP ${response.status}`;
    const error = new Error(String(message)) as Error & {
      statusCode?: number;
      responseData?: any;
    };
    error.statusCode = response.status;
    error.responseData = data;
    throw error;
  }

  return { statusCode: response.status, data, baseUrl };
}

export async function emitirNaFocus(nota: any) {
  const path = documentPath(nota);
  const payload = buildFocusPayload(nota);
  const result = await focusRequest(
    nota.empresaFiscal,
    `/v2/${path}?ref=${encodeURIComponent(nota.referencia)}`,
    "POST",
    payload,
  );

  return { ...result, payload };
}

export async function consultarNaFocus(nota: any) {
  const path = documentPath(nota);
  return focusRequest(
    nota.empresaFiscal,
    `/v2/${path}/${encodeURIComponent(nota.referencia)}`,
    "GET",
  );
}

export async function cancelarNaFocus(nota: any, justificativa: string) {
  const path = documentPath(nota);
  return focusRequest(
    nota.empresaFiscal,
    `/v2/${path}/${encodeURIComponent(nota.referencia)}`,
    "DELETE",
    { justificativa },
  );
}

export function parseFocusResult(baseUrl: string, data: any) {
  const rawStatus = String(data?.status || data?.situacao || "").toLowerCase();
  let status = "PROCESSANDO";

  // A Focus usa valores como processando_autorizacao, autorizado,
  // erro_autorizacao e cancelado. Erros precisam ser avaliados antes de
  // "autorizacao", senão "erro_autorizacao" seria marcado como autorizado.
  if (rawStatus.includes("erro") || rawStatus.includes("rejeit")) status = "REJEITADA";
  else if (rawStatus.includes("cancel")) status = "CANCELADA";
  else if (rawStatus.includes("process") || rawStatus.includes("fila")) status = "PROCESSANDO";
  else if (rawStatus.includes("autoriz")) status = "AUTORIZADA";

  const mensagem =
    data?.mensagem_sefaz ||
    data?.mensagem ||
    data?.message ||
    data?.status_sefaz ||
    data?.erros?.[0]?.mensagem ||
    undefined;

  return {
    status,
    numero: data?.numero || data?.numero_nfe || data?.numero_nfse || data?.numero_rps,
    serie: data?.serie || data?.serie_nfe || data?.serie_rps,
    chave: data?.chave_nfe || data?.chave_nfse || data?.chave,
    protocolo:
      data?.protocolo || data?.protocolo_autorizacao || data?.numero_protocolo,
    codigoVerificacao: data?.codigo_verificacao,
    caminhoXml: normalizeUrl(
      baseUrl,
      data?.caminho_xml_nota_fiscal || data?.caminho_xml || data?.url_xml,
    ),
    caminhoPdf: normalizeUrl(
      baseUrl,
      data?.caminho_danfe ||
        data?.caminho_pdf ||
        data?.url_danfe ||
        data?.url_pdf ||
        data?.caminho_danfse,
    ),
    mensagem,
  };
}

export async function emitirCartaCorrecaoNaFocus(nota: any, correcao: string) {
  if (nota.tipo !== "NFE") {
    throw new Error("Carta de correção está disponível somente para NF-e.");
  }
  return focusRequest(
    nota.empresaFiscal,
    `/v2/nfe/${encodeURIComponent(nota.referencia)}/carta_correcao`,
    "POST",
    { correcao },
  );
}
