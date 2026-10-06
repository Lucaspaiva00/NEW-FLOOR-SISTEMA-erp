import { Request, Response } from "express";
import prisma from "../prisma";
import { centavos, saldoConta, validarVinculos, movimentarConta } from "../services/pagamentos.service";
import {
  garantirCategoriasPadrao,
  sincronizarPropostaFaturada,
  sincronizarTodasPropostasFaturadas,
} from "../services/financeiro.service";

function idParam(value: string | string[] | undefined) {
  return Number(Array.isArray(value) ? value[0] : value);
}

function parseDate(value: any): Date | null {
  if (!value) return null;
  const date = new Date(typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value + "T12:00:00-03:00" : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function inicioDia(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function inicioMes(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function fimMes(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

function nomeCliente(cliente: any) {
  return cliente?.nomeFantasia || cliente?.razaoSocial || cliente?.responsavel || null;
}

function dataLocal(date: Date) {
 const p=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
 const v=(key:string)=>p.find(x=>x.type===key)!.value;
 return `${v('year')}-${v('month')}-${v('day')}`;
}
function vencimentoDia(date:Date){return date.toISOString().endsWith("T00:00:00.000Z")?date.toISOString().slice(0,10):dataLocal(date);}
function eventos(pagamentos: any[]) {
 return pagamentos.flatMap(p=>[{tipo:p.lancamento.tipo,valor:Number(p.valor),data:p.dataPagamento},...(p.estornadoEm?[{tipo:p.lancamento.tipo,valor:-Number(p.valor),data:p.estornadoEm}]:[])]);
}
export const dashboard = async (req: Request, res: Response): Promise<void> => {
 try {
  const empresaId=req.empresaId as number, ano=Number(req.query.ano||dataLocal(new Date()).slice(0,4));
  if(!Number.isInteger(ano)||ano<2000||ano>2100){res.status(400).json({error:'Ano inválido'});return;}
  const [abertos,contas,pagamentos]=await Promise.all([
   prisma.lancamentoFinanceiro.findMany({where:{empresaId,status:'ABERTO'},include:{cliente:true,categoria:true,conta:true,proposta:true},orderBy:{dataVencimento:'asc'}}),
   prisma.contaFinanceira.findMany({where:{empresaId}}),
   prisma.pagamentoFinanceiro.findMany({where:{empresaId},include:{lancamento:{select:{tipo:true}}}})
  ]);
  const hoje=dataLocal(new Date()),mesAtual=hoje.slice(0,7);
  const receber=abertos.filter(l=>l.tipo==='ENTRADA').reduce((n,l)=>n+centavos(saldoConta(l.valor,l.valorPago)),0)/100;
  const pagar=abertos.filter(l=>l.tipo==='SAIDA').reduce((n,l)=>n+centavos(saldoConta(l.valor,l.valorPago)),0)/100;
  const vencidos=abertos.filter(l=>l.dataVencimento&&vencimentoDia(l.dataVencimento)<hoje);
  const movimentos=eventos(pagamentos),recebidoPorMes=Array(12).fill(0);
  let recebidoMes=0,pagoMes=0;
  for(const e of movimentos){const data=dataLocal(e.data);if(e.tipo==='ENTRADA'&&Number(data.slice(0,4))===ano)recebidoPorMes[Number(data.slice(5,7))-1]+=e.valor;if(data.slice(0,7)===mesAtual){if(e.tipo==='ENTRADA')recebidoMes+=e.valor;else pagoMes+=e.valor;}}
  const saldoDisponivel=(contas.reduce((n,c)=>n+Math.round(Number(c.saldoInicial)*100),0)+movimentos.reduce((n,e)=>n+Math.round(e.valor*100)*(e.tipo==='ENTRADA'?1:-1),0))/100;
  res.json({ano,recebidoPorMes:recebidoPorMes.map(v=>Math.round(v*100)/100),saldoDisponivel,contasReceber:receber,contasPagar:pagar,saldoProjetado:saldoDisponivel+receber-pagar,recebidoMes,pagoMes,resultadoMes:recebidoMes-pagoMes,vencidosValor:vencidos.reduce((n,l)=>n+centavos(saldoConta(l.valor,l.valorPago)),0)/100,vencidosQuantidade:vencidos.length,ultimos:abertos.slice(0,8).map(l=>({...l,valorRestante:saldoConta(l.valor,l.valorPago),clienteNome:nomeCliente(l.cliente)}))});
 }catch(error){console.error(error);res.status(500).json({error:'Não foi possível carregar as contas a pagar e receber.'});}
};
export const fluxo = async (req: Request, res: Response): Promise<void> => {
 try {
  const empresaId=req.empresaId as number,meses=Math.min(Math.max(Number(req.query.meses||6),1),12);
  if(!Number.isInteger(meses)){res.status(400).json({error:'Período inválido'});return;}
  const hoje=dataLocal(new Date()),ano=Number(hoje.slice(0,4)),mes=Number(hoje.slice(5,7))-1;
  const [pagamentos,abertos]=await Promise.all([prisma.pagamentoFinanceiro.findMany({where:{empresaId},include:{lancamento:{select:{tipo:true}}}}),prisma.lancamentoFinanceiro.findMany({where:{empresaId,status:'ABERTO',dataVencimento:{not:null}}})]);
  let inicio=new Date(Date.UTC(ano,mes-(meses-1),1)).toISOString().slice(0,10);
  let fim=new Date(Date.UTC(ano,mes+1,0)).toISOString().slice(0,10);
  if(req.query.inicio!==undefined||req.query.fim!==undefined){
    const valido=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(new Date(v).getTime())&&new Date(v).toISOString().slice(0,10)===v;
    if(!valido(req.query.inicio)||!valido(req.query.fim)||req.query.inicio>req.query.fim){res.status(400).json({error:'Informe datas válidas, com início anterior ou igual ao fim.'});return;}
    inicio=req.query.inicio;fim=req.query.fim;
  }
  const primeiro=new Date(inicio+'T12:00:00Z'),ultimo=new Date(fim+'T12:00:00Z');
  const quantidade=(ultimo.getUTCFullYear()-primeiro.getUTCFullYear())*12+ultimo.getUTCMonth()-primeiro.getUTCMonth()+1;
  if(quantidade>120){res.status(400).json({error:'Selecione um período de até 10 anos.'});return;}
  const mapa=new Map<string,any>();
  for(let i=0;i<quantidade;i++){const d=new Date(Date.UTC(primeiro.getUTCFullYear(),primeiro.getUTCMonth()+i,15));const key=d.toISOString().slice(0,7);mapa.set(key,{mes:d.toLocaleDateString('pt-BR',{month:'short',year:'numeric',timeZone:'UTC'}),entradas:0,saidas:0,previstoReceber:0,previstoPagar:0});}
  for(const e of eventos(pagamentos)){const dia=dataLocal(e.data);if(dia<inicio||dia>fim)continue;const item=mapa.get(dia.slice(0,7));if(item)item[e.tipo==='ENTRADA'?'entradas':'saidas']+=e.valor;}
  for(const l of abertos){const dia=vencimentoDia(l.dataVencimento!);if(dia<inicio||dia>fim)continue;const item=mapa.get(dia.slice(0,7));if(item)item[l.tipo==='ENTRADA'?'previstoReceber':'previstoPagar']+=saldoConta(l.valor,l.valorPago);}
  res.json([...mapa.values()]);
 }catch(error){console.error(error);res.status(500).json({error:'Erro ao carregar movimentações e contas pendentes.'});}
};

export const listar = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tipo, status, busca, vencimento } = req.query;
    const hoje = inicioDia();
    const where: any = { empresaId: req.empresaId as number };

    if (tipo === "ENTRADA" || tipo === "SAIDA") where.tipo = tipo;
    if (status === "ABERTO" || status === "PAGO" || status === "CANCELADO") where.status = status;
    if (vencimento === "VENCIDO") where.dataVencimento = { lt: hoje };
    if (vencimento === "HOJE") {
      const amanha = new Date(hoje);
      amanha.setDate(amanha.getDate() + 1);
      where.dataVencimento = { gte: hoje, lt: amanha };
    }
    if (busca) {
      where.OR = [
        { descricao: { contains: String(busca), mode: "insensitive" } },
        { documento: { contains: String(busca), mode: "insensitive" } },
        { favorecido: { contains: String(busca), mode: "insensitive" } },
        { cliente: { nomeFantasia: { contains: String(busca), mode: "insensitive" } } },
        { cliente: { razaoSocial: { contains: String(busca), mode: "insensitive" } } },
      ];
    }

    const dados = await prisma.lancamentoFinanceiro.findMany({
      where,
      include: { cliente: true, categoria: true, conta: true, proposta: true, pagamentos: {orderBy:{createdAt:"desc"}} },
      orderBy: [{ status: "asc" }, { dataVencimento: "asc" }, { createdAt: "desc" }],
    });

    res.json(dados.map((item) => ({ ...item, valorRestante: saldoConta(item.valor,item.valorPago), clienteNome: nomeCliente(item.cliente) })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao listar lançamentos financeiros" });
  }
};

export const buscar = async (req: Request, res: Response): Promise<void> => {
  try {
    const dado = await prisma.lancamentoFinanceiro.findFirst({
      where: { lancamentofinanceiroid: idParam(req.params.id), empresaId: req.empresaId as number },
      include: { cliente: true, categoria: true, conta: true, proposta: true, pagamentos: {orderBy:{createdAt:"desc"}} },
    });
    if (!dado) {
      res.status(404).json({ error: "Lançamento não encontrado" });
      return;
    }
    res.json(dado);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar lançamento" });
  }
};

export const criar = async (req: Request, res: Response): Promise<void> => {
  try {
    const b = req.body;
    const empresaId = req.empresaId as number;
    if(!["ENTRADA","SAIDA"].includes(b.tipo))throw new Error("Escolha conta a receber ou a pagar.");
    const tipo = b.tipo;
    const valor = centavos(b.valor)/100;
    if (!b.descricao?.trim() || valor <= 0) {
      res.status(400).json({ error: "Informe descrição e valor maior que zero." });
      return;
    }

    const totalParcelas = Math.min(Math.max(Number(b.totalParcelas || 1), 1), 120);
    const intervaloDias = Math.max(Number(b.intervaloDias || 30), 1);
    const primeiraData = parseDate(b.dataVencimento);
    const frequencia=b.frequenciaParcelas||"DIAS";
    if(!["MENSAL","DIAS"].includes(frequencia))throw new Error("Escolha parcelamento mensal ou intervalo em dias.");
    if(b.dataVencimento&&!primeiraData)throw new Error("Informe um vencimento válido.");
    if(totalParcelas>1&&!primeiraData)throw new Error("Informe o primeiro vencimento para parcelar.");
    if(!Number.isInteger(totalParcelas)||!Number.isInteger(intervaloDias)||centavos(valor)<totalParcelas)throw new Error('Parcelas e intervalo devem ser inteiros e cada parcela deve ter ao menos um centavo.');
    const criados = await prisma.$transaction(async tx=>{
    await validarVinculos(tx,empresaId,{...b,tipo});
    const criados=[];

    for (let i = 1; i <= totalParcelas; i++) {
      let vencimento = primeiraData ? new Date(primeiraData) : null;
      if(vencimento&&i>1){
        if(frequencia==="MENSAL"){
          const dia=primeiraData!.getUTCDate(),mes=primeiraData!.getUTCMonth()+i-1,ano=primeiraData!.getUTCFullYear();
          const ultimo=new Date(Date.UTC(ano,mes+1,0)).getUTCDate();
          vencimento=new Date(Date.UTC(ano,mes,Math.min(dia,ultimo),15));
        }else vencimento.setUTCDate(vencimento.getUTCDate()+intervaloDias*(i-1));
      }
      const valorParcela = Math.floor(centavos(valor) / totalParcelas) / 100;
      const ajusteUltima = i === totalParcelas ? Math.round((valor - valorParcela * (totalParcelas - 1)) * 100) / 100 : valorParcela;

      criados.push(await tx.lancamentoFinanceiro.create({
        data: {
          empresaId: req.empresaId as number,
          tipo,
          status: "ABERTO",
          origem: "MANUAL",
          descricao: totalParcelas > 1 ? `${b.descricao.trim()} (${i}/${totalParcelas})` : b.descricao.trim(),
          documento: b.documento || null,
          valor: ajusteUltima,
          dataCompetencia: parseDate(b.dataCompetencia) || new Date(),
          dataVencimento: vencimento,
          formaPagamento: b.formaPagamento || null,
          parcelaNumero: i,
          totalParcelas,
          observacoes: b.observacoes || null,
          favorecido: b.favorecido || null,
          clienteId: b.clienteId ? Number(b.clienteId) : null,
          categoriaFinanceiraId: b.categoriaFinanceiraId ? Number(b.categoriaFinanceiraId) : null,
          contaFinanceiraId: b.contaFinanceiraId ? Number(b.contaFinanceiraId) : null,
        },
      }));
    }

    return criados;
    });
    res.status(201).json(criados);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Erro ao cadastrar conta." });
  }
};

export const atualizar = async (req: Request, res: Response): Promise<void> => {
  try {
    const b = req.body;
    const id = idParam(req.params.id);
    const empresaId = req.empresaId as number;
    const dado = await prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT "lancamentofinanceiroid" FROM "LancamentoFinanceiro" WHERE "lancamentofinanceiroid"=${id} AND "empresaId"=${empresaId} FOR UPDATE`;
    const atual = await tx.lancamentoFinanceiro.findFirst({ where: { lancamentofinanceiroid: id, empresaId } });
    if (!atual) {
      throw new Error("Conta não encontrada.");
    }
    if (atual.status !== "ABERTO") {
      throw new Error("Somente contas em aberto podem ser alteradas.");
    }

    if(b.tipo && !["ENTRADA","SAIDA"].includes(b.tipo))throw new Error("Escolha conta a receber ou a pagar.");
    if(b.descricao!==undefined&&!String(b.descricao).trim())throw new Error("Informe a descrição da conta.");
    await validarVinculos(tx,empresaId,{...b,tipo:b.tipo||atual.tipo});
    if(b.valor!==undefined && centavos(b.valor)<=0)throw new Error('Informe um valor maior que zero.');
    if(atual.origem==="PROPOSTA"&&((b.valor!==undefined&&centavos(b.valor)!==centavos(atual.valor))||(b.tipo&&b.tipo!==atual.tipo)||(b.clienteId!==undefined&&Number(b.clienteId||0)!==Number(atual.clienteId||0))))throw new Error("Altere o valor e o cliente na proposta de origem para manter os registros consistentes.");
    const historico=await tx.pagamentoFinanceiro.count({where:{lancamentoId:id,empresaId}});
    if(historico && ((b.valor!==undefined&&centavos(b.valor)!==centavos(atual.valor))||(b.tipo&&b.tipo!==atual.tipo)))throw new Error('Uma conta com pagamentos não pode ter seu valor ou tipo alterado.');
    return tx.lancamentoFinanceiro.update({
      where: { lancamentofinanceiroid: id },
      data: {
        tipo: b.tipo === "SAIDA" ? "SAIDA" : b.tipo === "ENTRADA" ? "ENTRADA" : atual.tipo,
        descricao: b.descricao ?? atual.descricao,
        documento: b.documento !== undefined ? b.documento || null : atual.documento,
        valor: b.valor !== undefined ? Number(b.valor) : atual.valor,
        dataCompetencia: b.dataCompetencia !== undefined ? parseDate(b.dataCompetencia) || atual.dataCompetencia : atual.dataCompetencia,
        dataVencimento: b.dataVencimento !== undefined ? parseDate(b.dataVencimento) : atual.dataVencimento,
        formaPagamento: b.formaPagamento !== undefined ? b.formaPagamento || null : atual.formaPagamento,
        favorecido: b.favorecido !== undefined ? b.favorecido || null : atual.favorecido,
        observacoes: b.observacoes !== undefined ? b.observacoes || null : atual.observacoes,
        clienteId: b.clienteId !== undefined ? (b.clienteId ? Number(b.clienteId) : null) : atual.clienteId,
        categoriaFinanceiraId: b.categoriaFinanceiraId !== undefined ? (b.categoriaFinanceiraId ? Number(b.categoriaFinanceiraId) : null) : atual.categoriaFinanceiraId,
        contaFinanceiraId: b.contaFinanceiraId !== undefined ? (b.contaFinanceiraId ? Number(b.contaFinanceiraId) : null) : atual.contaFinanceiraId,
      },
    });
    });
    res.json(dado);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Erro ao atualizar conta." });
  }
};

export const baixar = async(req:Request,res:Response):Promise<void>=>{
 try{res.json(await movimentarConta(idParam(req.params.id),req.empresaId as number,req.body));}
 catch(error:any){res.status(400).json({error:error.message||'Erro ao registrar pagamento.'});}
};
export const reabrir = async(req:Request,res:Response):Promise<void>=>{
 try{res.json(await movimentarConta(idParam(req.params.id),req.empresaId as number,req.body,true));}
 catch(error:any){res.status(400).json({error:error.message||'Erro ao estornar pagamento.'});}
};

export const cancelar = async (req: Request, res: Response): Promise<void> => {
  try {
    const atual=await prisma.lancamentoFinanceiro.findFirst({where:{lancamentofinanceiroid:idParam(req.params.id),empresaId:req.empresaId as number}});
    if(!atual || Number(atual.valorPago)>0){res.status(400).json({error:'Estorne os pagamentos antes de cancelar a conta.'});return;}
    const resultado = await prisma.lancamentoFinanceiro.updateMany({
      where: { lancamentofinanceiroid: idParam(req.params.id), empresaId: req.empresaId as number, valorPago: 0 },
      data: { status: "CANCELADO" },
    });
    if (resultado.count === 0) {
      res.status(404).json({ error: "Lançamento não encontrado" });
      return;
    }
    const dado = await prisma.lancamentoFinanceiro.findFirst({ where: { lancamentofinanceiroid: idParam(req.params.id), empresaId: req.empresaId as number } });
    res.json(dado);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao cancelar lançamento" });
  }
};

export const excluir = async (req: Request, res: Response): Promise<void> => {
  try {
    const atual = await prisma.lancamentoFinanceiro.findFirst({ where: { lancamentofinanceiroid: idParam(req.params.id), empresaId: req.empresaId as number } });
    if (!atual) {
      res.status(404).json({ error: "Lançamento não encontrado" });
      return;
    }
    if (atual.origem === "PROPOSTA" || Number(atual.valorPago)>0 || await prisma.pagamentoFinanceiro.count({where:{lancamentoId:atual.lancamentofinanceiroid}})) {
      res.status(400).json({ error: "Lançamentos originados de proposta não são excluídos. Cancele o lançamento se necessário." });
      return;
    }
    await prisma.lancamentoFinanceiro.delete({ where: { lancamentofinanceiroid: atual.lancamentofinanceiroid } });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao excluir lançamento" });
  }
};

export const categorias = async (req: Request, res: Response): Promise<void> => {
  try {
    const empresaId = req.empresaId as number;
    await garantirCategoriasPadrao(empresaId);
    res.json(await prisma.categoriaFinanceira.findMany({ where: { empresaId }, orderBy: [{ tipo: "asc" }, { nome: "asc" }] }));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao listar categorias" });
  }
};

export const criarCategoria = async (req: Request, res: Response): Promise<void> => {
  try {
    const tipo = req.body.tipo === "SAIDA" ? "SAIDA" : "ENTRADA";
    const nome = String(req.body.nome || "").trim();
    if (!nome) {
      res.status(400).json({ error: "Informe o nome da categoria." });
      return;
    }
    const dado = await prisma.categoriaFinanceira.create({
      data: { empresaId: req.empresaId as number, nome, tipo, descricao: req.body.descricao || null, cor: req.body.cor || null },
    });
    res.status(201).json(dado);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error?.code === "P2002" ? "Esta categoria já existe." : "Erro ao criar categoria" });
  }
};

export const contas = async (req: Request, res: Response): Promise<void> => {
  try {
    const empresaId = req.empresaId as number;
    const dados = await prisma.contaFinanceira.findMany({ where: { empresaId }, orderBy: [{ ativo: "desc" }, { nome: "asc" }] });
    const pagos = await prisma.pagamentoFinanceiro.findMany({where:{empresaId,estornadoEm:null},include:{lancamento:{select:{tipo:true}}}});
    res.json(dados.map((conta) => {
      let saldo = Number(conta.saldoInicial || 0);
      for (const p of pagos) {
        if (p.contaFinanceiraId !== conta.contafinanceiraid) continue;
        saldo += p.lancamento.tipo === "ENTRADA" ? Number(p.valor) : -Number(p.valor);
      }
      return { ...conta, saldoAtual: saldo };
    }));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao listar contas" });
  }
};

export const criarConta = async (req: Request, res: Response): Promise<void> => {
  try {
    const nome = String(req.body.nome || "").trim();
    if (!nome) {
      res.status(400).json({ error: "Informe o nome da conta." });
      return;
    }
    const tipos = ["BANCO", "CAIXA", "CARTEIRA"];
    const tipo = tipos.includes(req.body.tipo) ? req.body.tipo : "BANCO";
    const dado = await prisma.contaFinanceira.create({
      data: {
        empresaId: req.empresaId as number,
        nome,
        tipo,
        banco: req.body.banco || null,
        agencia: req.body.agencia || null,
        conta: req.body.conta || null,
        saldoInicial: Number(req.body.saldoInicial || 0),
      },
    });
    res.status(201).json(dado);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao criar conta financeira" });
  }
};

export const sincronizarFaturadas = async (req: Request, res: Response): Promise<void> => {
  try {
    const quantidade = await sincronizarTodasPropostasFaturadas(req.empresaId as number);
    res.json({ success: true, quantidade });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao sincronizar propostas faturadas" });
  }
};

export const importarProposta = async (req: Request, res: Response): Promise<void> => {
  try {
    const propostaId = idParam(req.params.id);
    const empresaId = req.empresaId as number;
    const proposta = await prisma.proposta.findFirst({
      where: { propostaid: propostaId, empresaId },
      include: { cliente: true },
    });
    if (!proposta) {
      res.status(404).json({ error: "Proposta não encontrada" });
      return;
    }
    if (proposta.status !== "FATURADA") {
      res.status(400).json({ error: "A entrada financeira só é gerada quando a proposta estiver FATURADA." });
      return;
    }
    const lancamento = await sincronizarPropostaFaturada(propostaId, empresaId);
    res.json(lancamento);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao importar proposta para o financeiro" });
  }
};
