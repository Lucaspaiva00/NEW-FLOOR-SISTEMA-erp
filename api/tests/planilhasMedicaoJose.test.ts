import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { detectarPlanilha, gerarExcel, aplicarEdicoes, validarXlsx } from "../src/services/planilhasMedicaoJose.service";
import { somenteJose } from "../src/controller/ctplanilhasMedicaoJose";

async function exemplo() {
  const workbook = new ExcelJS.Workbook();
  const civil = workbook.addWorksheet("Escopo MO Civil_CASA SEDE");
  civil.getCell("C9").value = "Objeto: Escopo de Serviços Mão de Obra Civil";
  civil.getCell("L9").value = "MEDIÇÃO 01";
  civil.getCell("P9").value = "MEDIÇÃO 02";
  civil.getCell("C10").value = "ITEM";
  civil.getCell("D10").value = "ETAPA";
  civil.getCell("E10").value = "DESCRIÇÃO";
  civil.getCell("I10").value = "VALOR UNITÁRIO";
  civil.getCell("C11").value = "1";
  civil.getCell("D11").value = "Infraestrutura";
  civil.getCell("E11").value = "Fundação";
  civil.getCell("I11").value = 10000;
  civil.getCell("L11").value = 0.4;
  civil.getCell("M11").value = { formula: "SUM(L11)", result: 0.4 };
  civil.getCell("P11").value = 0.1;
  civil.getCell("A1").value = "Logo / cabeçalho original não pode ser apagado";
  const extra = workbook.addWorksheet("Aba sem medição");
  extra.getCell("A1").value = "Preservar o texto original";
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

test("prévia reconhece medições e preserva abas não reconhecidas", async () => {
  const source = await exemplo();
  const parsed = await detectarPlanilha(source);
  assert.equal(parsed.abas.length, 2);
  assert.equal(parsed.abas[0].reconhecida, true);
  assert.equal(parsed.abas[1].reconhecida, false);
  assert.deepEqual(parsed.abas[0].medicoes.map(m => m.numero), [1, 2]);
  assert.equal(parsed.abas[0].itens[0].percentuais["1"], 40);
  assert.equal(parsed.abas[0].itens[0].valor, 10000);
});

test("edição modifica apenas o percentual e preserva fórmula original, cabeçalho e demais abas", async () => {
  const source = await exemplo(), parsed = await detectarPlanilha(source);
  aplicarEdicoes(parsed.abas[0], { "11": 30 }, 1);
  assert.throws(() => aplicarEdicoes(parsed.abas[0], { "99": 40 }, 1));
  const output = await gerarExcel(source, parsed.abas, { "0:11:1": 30 });
  const livro = new ExcelJS.Workbook();
  await livro.xlsx.load(output as any);
  assert.equal(livro.worksheets[0].getCell("L11").value, 0.3);
  assert.equal((livro.worksheets[0].getCell("M11").value as any).formula, "SUM(L11)");
  assert.equal(livro.worksheets[0].getCell("A1").value, "Logo / cabeçalho original não pode ser apagado");
  assert.equal(livro.worksheets[1].getCell("A1").value, "Preservar o texto original");
  assert.equal(source.equals(output), false);
});

test("XLSX inválido não é aceito", () => {
  assert.throws(() => validarXlsx("nao-e-planilha"));
});

test("SBA e New Floor são rejeitados sem consultar banco ou tocar nos outros perfis", async () => {
  for (const empresaId of [1, 2, 3, 4]) {
    let status = 0, erro = "";
    const response: any = {
      status(n: number) { status = n; return response; },
      json(d: any) { erro = d.error; return response; }
    };
    await somenteJose({ empresaId, configuracaoSistema: { modulos: { obras: true } } } as any,
      response, () => { throw Error("Nunca permitir outro tenant."); });
    assert.equal(status, 403);
    assert.match(erro, /José/);
  }
});
