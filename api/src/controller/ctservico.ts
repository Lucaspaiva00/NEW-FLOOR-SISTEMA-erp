import { Request, Response } from "express";
import prisma from "../prisma";

export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body;
    if(req.configuracaoSistema?.composicaoCustos && body.dadosMaterial != null) {
      const d=body.dadosMaterial;
      if(typeof d!=="object" || Array.isArray(d) || JSON.stringify(d).length>3000000 || (d.fotos && (!Array.isArray(d.fotos)||d.fotos.length>10||d.fotos.some((f:any)=>typeof f!=="string"||!/^data:image\/(jpeg|png|webp);base64,/.test(f))))) {
       res.status(400).json({error:"Cadastro de material inválido ou fotos acima do limite"});return;
      }
      for(const key of ["custo","estoqueFisico","estoqueFiscal","preFaturado","disponivel"]){if(d[key]!==undefined && (!Number.isFinite(Number(d[key])) || Number(d[key])<0)){res.status(400).json({error:"Quantidade ou custo inválido"});return;}}
    }
    const empresaId = req.empresaId as number;

    const fornecedorId=Number(body.dadosMaterial?.fornecedorId||0);
    if(req.configuracaoSistema?.perfil==='SBA' && fornecedorId){
      const fornecedor=await prisma.fornecedor.findFirst({where:{fornecedorid:fornecedorId,empresaId}});
      if(!fornecedor){res.status(400).json({error:'Fornecedor não encontrado nesta empresa.'});return;}
      body.dadosMaterial.fornecedor=fornecedor.nome;
    }
    const servico = await prisma.$transaction(async tx=>{
     if(req.configuracaoSistema?.perfil==='SBA' && body.dadosMaterial){
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(${empresaId}::int, 721::int)`;
      if(body.codigoAutomatico!==false){
       const existentes=await tx.servico.findMany({where:{empresaId},select:{codigo:true}});
       const maior=existentes.reduce((max,s)=>{const m=s.codigo?.match(/^MAT-(\d+)$/);return m?Math.max(max,Number(m[1])):max;},0);
       body.codigo='MAT-'+String(maior+1).padStart(6,'0');
       body.dadosMaterial.codigo=body.codigo;
      }else if(!String(body.codigo||'').trim()){throw Error('Informe o código manual do material.');}
     }
     return tx.servico.create({
      data: {
        empresaId,
        codigo: body.codigo,
        dadosMaterial: req.configuracaoSistema?.composicaoCustos ? body.dadosMaterial : undefined,
        nome: body.nome,
        categoria: body.categoria,
        descricao: body.descricao,
        descricaoInterna: body.descricaoInterna,
        custo: body.custo,
        margemLucro: body.margemLucro,
        unidade: body.unidade,
        tempoExecucao: body.tempoExecucao,
        garantia: body.garantia,
        observacoes: body.observacoes,
        ativo: body.ativo ?? true,
        destaque: body.destaque ?? false
      }
    });

    });
    res.status(201).json(servico);
  } catch (error:any) {
    console.log(error);
    res.status(error.code==="P2002"?409:error.message==="Informe o código manual do material."?400:500).json({
      error: error.code==="P2002"?"Código de material já cadastrado.":error.message==="Informe o código manual do material."?error.message:"Erro ao cadastrar serviço"
    });
  }
};

export const read = async (req: Request, res: Response): Promise<void> => {
  try {
    const empresaId = req.empresaId as number;

    const servicos = await prisma.servico.findMany({
      where: { empresaId },
      include: {
        itens: {
          include: {
            proposta: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    res.status(200).json(servicos);
  } catch (error:any) {
    console.log(error);
    res.status(500).json({
      error: "Erro ao buscar serviços"
    });
  }
};

export const readOne = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const empresaId = req.empresaId as number;

    const servico = await prisma.servico.findFirst({
      where: {
        servicoid: Number(id),
        empresaId
      },
      include: {
        itens: {
          include: {
            proposta: true
          }
        }
      }
    });

    if (!servico) {
      res.status(404).json({
        error: "Serviço não encontrado"
      });
      return;
    }

    res.status(200).json(servico);
  } catch (error:any) {
    console.log(error);
    res.status(500).json({
      error: "Erro ao buscar serviço"
    });
  }
};

export const update = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const body = req.body;
    if(req.configuracaoSistema?.composicaoCustos && body.dadosMaterial != null) {
      const d=body.dadosMaterial;
      if(typeof d!=="object" || Array.isArray(d) || JSON.stringify(d).length>3000000 || (d.fotos && (!Array.isArray(d.fotos)||d.fotos.length>10||d.fotos.some((f:any)=>typeof f!=="string"||!/^data:image\/(jpeg|png|webp);base64,/.test(f))))) {
       res.status(400).json({error:"Cadastro de material inválido ou fotos acima do limite"});return;
      }
      for(const key of ["custo","estoqueFisico","estoqueFiscal","preFaturado","disponivel"]){if(d[key]!==undefined && (!Number.isFinite(Number(d[key])) || Number(d[key])<0)){res.status(400).json({error:"Quantidade ou custo inválido"});return;}}
    }
    const empresaId = req.empresaId as number;

    const fornecedorId=Number(body.dadosMaterial?.fornecedorId||0);
    if(req.configuracaoSistema?.perfil==='SBA' && fornecedorId){
      const fornecedor=await prisma.fornecedor.findFirst({where:{fornecedorid:fornecedorId,empresaId}});
      if(!fornecedor){res.status(400).json({error:'Fornecedor não encontrado nesta empresa.'});return;}
      body.dadosMaterial.fornecedor=fornecedor.nome;
    }
    const resultado = await prisma.servico.updateMany({
      where: {
        servicoid: Number(id),
        empresaId
      },
      data: {
        codigo: body.codigo,
        dadosMaterial: req.configuracaoSistema?.composicaoCustos ? body.dadosMaterial : undefined,
        nome: body.nome,
        categoria: body.categoria,
        descricao: body.descricao,
        descricaoInterna: body.descricaoInterna,
        custo: body.custo,
        margemLucro: body.margemLucro,
        unidade: body.unidade,
        tempoExecucao: body.tempoExecucao,
        garantia: body.garantia,
        observacoes: body.observacoes,
        ativo: body.ativo,
        destaque: body.destaque
      }
    });

    if (resultado.count === 0) {
      res.status(404).json({
        error: "Serviço não encontrado"
      });
      return;
    }

    const servico = await prisma.servico.findFirst({
      where: { servicoid: Number(id), empresaId }
    });

    res.status(200).json(servico);
  } catch (error:any) {
    console.log(error);
    res.status(error.code==="P2002"?409:error.message==="Informe o código manual do material."?400:500).json({
      error: error.code==="P2002"?"Código de material já cadastrado.":"Erro ao atualizar serviço"
    });
  }
};

export const remove = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const empresaId = req.empresaId as number;

    const resultado = await prisma.servico.deleteMany({
      where: {
        servicoid: Number(id),
        empresaId
      }
    });

    if (resultado.count === 0) {
      res.status(404).json({
        error: "Serviço não encontrado"
      });
      return;
    }

    res.status(200).json({
      message: "Serviço removido"
    });
  } catch (error:any) {
    console.log(error);
    res.status(500).json({
      error: "Erro ao remover serviço"
    });
  }
};
