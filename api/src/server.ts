import "dotenv/config";

import express from "express";
import cors from "cors";
import path from "path";
import routes from "./routes/routes";
import { garantirSchemaFinanceiro } from "./services/financeiroSchema.service";
import { seedHomologacaoSba } from "./services/seedSbaHomologacao.service";

import { garantirSchemaConfiguracao } from "./services/configuracaoSchema.service";
import { testarFluxoObras } from "./services/obrasSmoke.service";
import { testarTelaObras } from "./services/obrasUiSmoke.service";
import { garantirSchemaObras } from "./services/obrasSchema.service";
const app = express();

app.use(cors({ exposedHeaders: ["Content-Disposition"] }));
app.use(express.json({ limit: "10mb" }));

app.use(
  "/propostas",
  express.static(path.join(process.cwd(), "public", "propostas"))
);

app.use(
  "/assets",
  express.static(path.join(process.cwd(), "public", "assets"))
);

app.use(routes);

const PORT = process.env.PORT || 3000;

async function iniciarServidor() {
  await garantirSchemaConfiguracao();
  await garantirSchemaObras();
  console.log("Estrutura de obras verificada; ativação restrita a José/Construarty.");
  await testarFluxoObras();
  await testarTelaObras();
  try {
    await garantirSchemaFinanceiro();
    console.log("✅ Estrutura do módulo financeiro verificada.");
  } catch (error) {
    // Não derruba toda a API caso o banco tenha alguma restrição inesperada.
    // Assim o deploy novo entra no ar e o erro real fica visível nos logs.
    console.error("⚠️ Não foi possível verificar a estrutura financeira:", error);
  }

  // Semente controlada e temporária, estritamente opt-in no perfil SBA.
  // É idempotente e não gera transmissão fiscal nem faturamento.
  if (process.env.SEED_SBA_HOMOLOGACAO_20261023 === "CRIAR_UMA_VEZ_SBA_RASCUNHO") {
    try {
      const resultado = await seedHomologacaoSba();
      console.log("SBA: cenário de homologação verificado",{
        propostaId:resultado.propostaId,numero:resultado.numero,
        notaId:resultado.notaId,criado:resultado.criado
      });
    } catch (erro:any) {
      console.error("SBA: cenário de homologação não criado:",String(erro?.message||erro).slice(0,200));
    }
  }

  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log("Financeiro API: /financeiro/dashboard");
  });
}

void iniciarServidor();
