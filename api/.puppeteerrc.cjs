const path = require("node:path");

// Build e execução precisam carregar o mesmo Chrome, dentro do artefato da API.
module.exports = {
  cacheDirectory: path.join(__dirname, ".cache", "puppeteer"),
};
