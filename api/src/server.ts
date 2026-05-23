import "dotenv/config";

import express from "express";
import cors from "cors";
import path from "path";
import routes from "./routes/routes";

const app = express();

app.use(cors());

app.use(express.json({ limit: "10mb" }));

app.use(
  "/pdfs",
  express.static(path.resolve(__dirname, "../public/pdfs"))
);

app.use(routes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
