// Condições comerciais próprias da SBA; as demais empresas mantêm o formulário atual.
window.criarPagamentoSba = campo => {
 const box=document.createElement('div');box.className='sba-grid mb-3';
 box.innerHTML='<label>Forma de pagamento<input data-pagamento="forma" maxlength="100" placeholder="Pix, transferência, boleto…"></label><label>Prazo padrão (dias corridos)<input data-pagamento="prazo" type="number" min="0" max="3650" step="1" placeholder="Ex.: 60"></label>';
 campo.parentElement.before(box);
 return {forma:box.querySelector('[data-pagamento="forma"]'),prazo:box.querySelector('[data-pagamento="prazo"]')};
};
