import "dotenv/config";

import express from "express";
import cors from "cors";
import path from "path";
import routes from "./routes/routes";

const app = express();

app.use(cors());

app.use(express.json({ limit: "10mb" }));

app.use(
  "/propostas",
  express.static(
    path.join(
      process.cwd(),
      "public",
      "propostas"
    )
  )
);

app.use(routes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
