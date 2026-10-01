import { Request, Response } from "express";

type EmpresaConsultada = {
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
};

const cache = new Map<string, { empresa: EmpresaConsultada; expira: number }>();
const emAndamento = new Map<string, Promise<EmpresaConsultada>>();

class ErroConsulta extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function buscarEmpresa(cnpj: string): Promise<EmpresaConsultada> {
  const provedores = [
    { nome: "BrasilAPI", url: `https://brasilapi.com.br/api/cnpj/v1/${cnpj}` },
    { nome: "CNPJws", url: `https://publica.cnpj.ws/cnpj/${cnpj}` },
  ];
  const falhas: number[] = [];
  for (const provedor of provedores) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(provedor.url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        falhas.push(response.status);
        console.warn(`Consulta CNPJ: ${provedor.nome} retornou HTTP ${response.status}`);
        continue;
      }
      const dados = await response.json();
      let empresa: EmpresaConsultada;
      if (provedor.nome === "CNPJws") {
        const estabelecimento = dados?.estabelecimento;
        if (!estabelecimento || estabelecimento.cnpj !== cnpj) {
          falhas.push(502);
          continue;
        }
        empresa = {
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
        };
      } else {
        empresa = dados;
      }
      if (!empresa || typeof empresa.razao_social !== "string" || !empresa.razao_social.trim()) {
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
