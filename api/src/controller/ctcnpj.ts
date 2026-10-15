import { Request, Response } from "express";

type EmpresaConsultada = {
  cnae_fiscal?: number | string;
  cnaes_secundarios?: {codigo: number | string; descricao?: string}[];
  codigo_municipio_ibge?: number | string;
  razao_social: string;
  nome_fantasia?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  municipio?: string | null;
  uf?: string | null;
  email?: string | null;
  ddd_telefone_1?: string | null;
  ddd_telefone_2?: string | null;
  inscricao_estadual?: string | null;
};

const cache = new Map<string, { empresa: EmpresaConsultada; expira: number }>();
const emAndamento = new Map<string, Promise<EmpresaConsultada>>();
const pausaProvedorAte = new Map<string, number>();

export function cnpjValido(numero: string): boolean {
  const cnpj = String(numero || "").replace(/\D/g, "");
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  const digito = (base: string): number => {
    const pesos = base.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const resto = base.split("").reduce((soma, algarismo, indice) =>
      soma + Number(algarismo) * pesos[indice], 0) % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return Number(cnpj[12]) === digito(cnpj.slice(0, 12))
    && Number(cnpj[13]) === digito(cnpj.slice(0, 13));
}

class ErroConsulta extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function buscarEmpresa(cnpj: string): Promise<EmpresaConsultada> {
  const provedores = [
    { nome: "BrasilAPI", url: `https://brasilapi.com.br/api/cnpj/v1/${cnpj}` },
    { nome: "CNPJws", url: `https://publica.cnpj.ws/cnpj/${cnpj}` },
    { nome: "MinhaReceita", url: `https://minhareceita.org/${cnpj}` },
  ];
  const falhas: number[] = [];
  for (const provedor of provedores) {
    if ((pausaProvedorAte.get(provedor.nome) || 0) > Date.now()) {
      falhas.push(429);
      continue;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
      const response = await fetch(provedor.url, {
        signal: controller.signal,
        // O User-Agent padrao "node" sofre bloqueio 403 no WAF da BrasilAPI.
        headers: {
          Accept: "application/json",
          "User-Agent": "PaivaTechERP/1.0 (consulta publica de CNPJ)",
        },
      });
      if (!response.ok) {
        if (response.status === 429) {
          // A API publica do CNPJws permite apenas 3 consultas/minuto por IP.
          pausaProvedorAte.set(provedor.nome, Date.now() + 60_000);
        }
        falhas.push(response.status);
        console.warn(`Consulta CNPJ: ${provedor.nome} retornou HTTP ${response.status}`);
        continue;
      }
      const dados = await response.json();
      let empresa: EmpresaConsultada;
      if (provedor.nome === "CNPJws") {
        const estabelecimento = dados?.estabelecimento;
        if (!estabelecimento || String(estabelecimento.cnpj || "").replace(/\D/g, "") !== cnpj) {
          falhas.push(502);
          continue;
        }
        empresa = {
          cnae_fiscal: estabelecimento.atividade_principal?.id,
          cnaes_secundarios: estabelecimento.atividades_secundarias?.map((a:any)=>({codigo:a.id,descricao:a.descricao})),
          codigo_municipio_ibge: estabelecimento.cidade?.ibge_id,
          razao_social: dados.razao_social,
          nome_fantasia: estabelecimento.nome_fantasia,
          cep: estabelecimento.cep,
          logradouro: [estabelecimento.tipo_logradouro, estabelecimento.logradouro].filter(Boolean).join(" "),
          numero: estabelecimento.numero,
          complemento: estabelecimento.complemento,
          bairro: estabelecimento.bairro,
          municipio: estabelecimento.cidade?.nome,
          uf: estabelecimento.estado?.sigla,
          email: estabelecimento.email,
          ddd_telefone_1: [estabelecimento.ddd1, estabelecimento.telefone1].filter(Boolean).join(""),
          ddd_telefone_2: [estabelecimento.ddd2, estabelecimento.telefone2].filter(Boolean).join(""),
          inscricao_estadual: estabelecimento.inscricoes_estaduais?.find((ie:any)=>ie.ativo && ie.estado?.sigla===estabelecimento.estado?.sigla)?.inscricao_estadual,
        };
      } else {
        empresa = dados;
      }
      if (!empresa || typeof empresa.razao_social !== "string" || !empresa.razao_social.trim()
        || (dados?.cnpj && String(dados.cnpj).replace(/\D/g, "") !== cnpj)) {
        falhas.push(502);
        continue;
      }
      return empresa;
    } catch (error) {
      falhas.push(controller.signal.aborted ? 504 : 502);
      console.warn(`Consulta CNPJ: falha em ${provedor.nome}`, error);
    } finally {
      clearTimeout(timeout);
    }
  }
  // Uma fonte indisponível não significa que o CNPJ não existe.
  if (falhas.every((status) => status === 400 || status === 404)) {
    throw new ErroConsulta(404, "CNPJ inválido ou não encontrado nas bases de consulta. Confira o número informado.");
  }
  if (falhas.includes(429)) {
    throw new ErroConsulta(429, "Os serviços de CNPJ estão temporariamente indisponíveis ou com limite de consultas. Aguarde um minuto e tente novamente.");
  }
  throw new ErroConsulta(502, "Não foi possível consultar o CNPJ em nenhuma das fontes. Tente novamente ou preencha os dados manualmente.");
}

export const consultar = async (req: Request, res: Response): Promise<void> => {
  const cnpj = String(req.params.cnpj || "").replace(/\D/g, "");
  if (cnpj.length !== 14) {
    res.status(400).json({ error: "Informe um CNPJ com 14 dígitos." });
    return;
  }
  if (!cnpjValido(cnpj)) {
    res.status(400).json({ error: "CNPJ inválido: confira os dígitos verificadores do número informado." });
    return;
  }
  const salvo = cache.get(cnpj);
  if (salvo && salvo.expira > Date.now()) {
    res.json(salvo.empresa);
    return;
  }
  cache.delete(cnpj);
  try {
    let consulta = emAndamento.get(cnpj);
    if (!consulta) {
      consulta = buscarEmpresa(cnpj).then((empresa) => {
        if (cache.size >= 1000) cache.delete(cache.keys().next().value!);
        cache.set(cnpj, { empresa, expira: Date.now() + 60 * 60 * 1000 });
        return empresa;
      }).finally(() => emAndamento.delete(cnpj));
      emAndamento.set(cnpj, consulta);
    }
    res.json(await consulta);
  } catch (error) {
    res.status(error instanceof ErroConsulta ? error.status : 502).json({
      error: error instanceof ErroConsulta ? error.message : "Não foi possível consultar o CNPJ. Tente novamente.",
    });
  }
};
