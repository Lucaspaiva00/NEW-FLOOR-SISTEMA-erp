import test from "node:test";
import assert from "node:assert/strict";
import { usarModeloPdfSba } from "../src/services/propostaHtml.service";

test("prévia global mantém o modelo exclusivo da SBA pelo identificador da empresa", () => {
  assert.equal(usarModeloPdfSba({ slug: "sba", nome: "Serralheria SBA",
    configuracaoSistema: { perfil: "SBA" } }), true);
  assert.equal(usarModeloPdfSba({ slug: "sba", nome: "Serralheria SBA",
    configuracaoSistema: { perfil: "PADRAO" } }), true);
});
test("prévia global não usa PDF da SBA no perfil New Floor ou José", () => {
  assert.equal(usarModeloPdfSba({ slug: "new-floor", nome: "New Floor Pisos e Revestimentos",
    configuracaoSistema: { perfil: "PADRAO" } }), false);
  assert.equal(usarModeloPdfSba({ slug: "construarty", nome: "Construarty",
    configuracaoSistema: { perfil: "PERSONALIZADO" } }), false);
});
