export const TEXTO_SBA = "NAO INCLUI - ART E QUAISQUER OUTRAS PECAS E SERVICOS QUE NAO ESTEJAM RELACIONADOS NESTE ORCAMENTO.\nPRAZO DE ENTREGA - A COMBINAR\nIPI ISENTO";
export const MODULOS = ["dashboard", "clientes", "servicos", "propostas", "vendedores", "agenda", "templates", "financeiro", "fiscal"] as const;
export function resolverConfiguracao(valor: any) {
 const perfil = ["SBA", "PERSONALIZADO"].includes(valor?.perfil) ? valor.perfil : "PADRAO";
 const sba = perfil === "SBA";
 const modulos = Object.fromEntries(MODULOS.map(k => [k, typeof valor?.modulos?.[k] === "boolean" ? valor.modulos[k] : true]));
 const camposProposta = Object.fromEntries(["prioridade", "origem", "frete", "validadeDias"].map(k => [k, typeof valor?.camposProposta?.[k] === "boolean" ? valor.camposProposta[k] : !sba]));
 const flags = Object.fromEntries(["reformaTributaria", "selecionarDestinatario", "certificadoA1", "composicaoCustos", "ocultarEscopoVazio"].map(k => [k, typeof valor?.[k] === "boolean" ? valor[k] : sba]));
 return { perfil, modulos, camposProposta, reformaTributaria: flags.reformaTributaria, selecionarDestinatario: flags.selecionarDestinatario, certificadoA1: flags.certificadoA1, composicaoCustos: flags.composicaoCustos, ocultarEscopoVazio: flags.ocultarEscopoVazio, textoEscopo: typeof valor?.textoEscopo === "string" ? valor.textoEscopo.slice(0,10000) : sba ? TEXTO_SBA : "" };
}
export function prepararCampos(body: any, config: ReturnType<typeof resolverConfiguracao>) {
 const copy = { ...body };
 for (const k of Object.keys(config.camposProposta)) if (!config.camposProposta[k]) copy[k] = k === "frete" ? 0 : null;
 return copy;
}
export function validarConfiguracao(c: ReturnType<typeof resolverConfiguracao>) {
 const deps: Record<string,string[]> = {propostas:["clientes","servicos","templates","vendedores"], agenda:["clientes"], fiscal:["clientes","propostas"]};
 for(const [m,ds] of Object.entries(deps)) if(c.modulos[m] && ds.some(d=>!c.modulos[d])) throw new Error(`O módulo ${m} depende de ${ds.join(", ")}.`);
 if(c.composicaoCustos && (!c.modulos.propostas || !c.modulos.servicos)) throw new Error("Composição de custos exige propostas e serviços.");
}
