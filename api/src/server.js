require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const routes = require("./routes/routes");

const app = express();

app.use(cors());

app.use(express.json({ limit: "10mb" }));

app.use("/pdfs", express.static(
    path.resolve(__dirname, "../public/pdfs")
));

app.use(routes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});