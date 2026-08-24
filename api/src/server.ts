import "dotenv/config";

import express from "express";
import cors from "cors";
import path from "path";
import routes from "./routes/routes";
import { garantirSchemaFinanceiro } from "./services/financeiroSchema.service";

const app = express();

app.use(cors());
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
  try {
    await garantirSchemaFinanceiro();
    console.log("✅ Estrutura do módulo financeiro verificada.");
  } catch (error) {
    // Não derruba toda a API caso o banco tenha alguma restrição inesperada.
    // Assim o deploy novo entra no ar e o erro real fica visível nos logs.
    console.error("⚠️ Não foi possível verificar a estrutura financeira:", error);
  }

  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log("Financeiro API: /financeiro/dashboard");
  });
}

void iniciarServidor();
