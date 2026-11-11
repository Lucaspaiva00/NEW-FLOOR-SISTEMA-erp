import { AbaPlanilha, evolucaoAtual } from "./planilhasMedicaoJose.service";
import { data, dinheiro, texto, MARCA_ESCOPO_JOSE } from "./obras.service";
import { bloqueio, carregarObra, historico } from "./obrasOperacao.service";

export function prepararEscopoJose(aba: AbaPlanilha, edicoes: Record<string, number>, numero: number, dataCorte: unknown, confirmarExcedente = false) {
  if (!aba?.reconhecida || !aba.itens.length || aba.itens.length > 100) throw Error("Selecione uma aba reconhecida com até 100 etapas.");
  const realizadas = aba.medicoes.filter(m => m.numero <= numero && !m.prevista);
  const corte = realizadas.find(m => m.numero === numero);
  if (numero !== 0 && !corte) throw Error("Escolha a última medição efetivamente realizada, antes das previsões.");
  const fim = data(corte?.data || dataCorte);
  if (fim > new Date()) throw Error("A data do histórico deve ser até hoje.");
  const etapas = aba.itens.map(item => {
    const nome = texto([item.item, item.etapa, item.descricao].filter(Boolean).join(" · ").slice(0, 300), "nome da etapa", 300);
    const valor = dinheiro(item.valor);
    const medido = dinheiro(realizadas.reduce((soma, m) => {
      const progresso = evolucaoAtual(item, edicoes, aba, m.numero);
      return soma + (item.valoresMedidos?.[m.numero] ?? valor * progresso / 100);
    }, 0));
    if (!Number.isFinite(valor) || !Number.isFinite(medido) || valor < 0 || medido < 0 ) {
      throw Error("Confira o histórico da etapa " + nome + ". O valor medido precisa estar entre zero e o valor vigente.");
    }
    if (medido > valor && !confirmarExcedente) throw Error("A etapa " + nome + " já tem valor medido acima do previsto. Confirme o excedente para preservar o valor histórico e encerrar o avanço dessa etapa em 100%.");
    // A base do ERP aceita duas casas no percentual. Arredondar para cima evita cobrar novamente uma fração do histórico.
    const atual = valor ? Math.min(100, Math.ceil((medido / valor * 10000) - 0.00000001) / 100) : 0;
    return { nome, valor, medido, atual };
  });
  return { etapas, fim, contrato: dinheiro(etapas.reduce((soma, e) => soma + e.valor, 0)) };
}

export async function ativarEscopoJose(db: any, fonte: { id: number; obraId: number; aba: number }, base: ReturnType<typeof prepararEscopoJose>, usuarioId?: number) {
  const empresaId = 5;
  await bloqueio(db, empresaId);
  const obra = await carregarObra(db, empresaId, fonte.obraId);
  if (obra.status === "CANCELADA" || obra.status === "CONCLUIDA") throw Error("Selecione uma obra ativa.");
  if (!await db.cliente.findFirst({ where: { clienteid: obra.clienteId, empresaId }, select: { clienteid: true } })) throw Error("A obra precisa estar vinculada ao cliente da ConstruArty.");
  if (await db.medicaoObra.count({ where: { empresaId, obraId: obra.id } })) {
    throw Error("Esta obra já tem medições. Vincule a planilha a uma obra sem medições para preservar o histórico existente.");
  }
  if (base.contrato <= 0 || dinheiro(Number(obra.valorContrato)) !== base.contrato) {
    throw Error("O valor do contrato da obra deve ser igual ao total da aba importada.");
  }
  await db.etapaObra.deleteMany({ where: { obraId: obra.id } });
  const itens = [];
  for (const e of base.etapas) {
    const etapa = await db.etapaObra.create({ data: { obraId: obra.id, nome: e.nome, valor: e.valor } });
    itens.push({ etapaId: etapa.id, anterior: 0, atual: e.atual, valor: e.medido });
  }
  const valor = dinheiro(itens.reduce((soma, i) => soma + i.valor, 0));
  const marco = await db.medicaoObra.create({data:{
    empresaId, obraId: obra.id, inicio: base.fim, fim: base.fim, vencimento: base.fim,
    observacoes: MARCA_ESCOPO_JOSE + " · Planilha #" + fonte.id + " · Aba #" + fonte.aba,
    fotos: [], valor, status: "APROVADA", itens: { create: itens },
  }});
  await historico(db, empresaId, obra.id, usuarioId, "ATIVAR_ESCOPO_PLANILHA", obra.etapas, {
    planilhaId: fonte.id, aba: fonte.aba, marcoId: marco.id, dataCorte: base.fim, etapas: base.etapas,
  });
  return { marcoId: marco.id, etapas: itens.length, valorHistorico: valor };
}
