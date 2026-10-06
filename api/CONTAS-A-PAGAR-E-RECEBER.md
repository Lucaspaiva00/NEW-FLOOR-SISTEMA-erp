# Contas a pagar e receber

A página `financeiro.html` e as rotas `/financeiro` foram preservadas. O menu usa linguagem direta para todos os perfis; o módulo continua habilitável por empresa.

- Uma conta em aberto pode ter vários pagamentos. `valorPago` é o total dos pagamentos não estornados, e o saldo restante é `valor - valorPago`.
- Cada pagamento registra valor, data, conta financeira e forma. A quitação acontece somente ao alcançar o valor total.
- O estorno mantém o registro, data e motivo. Pode estornar um pagamento ou todos os pagamentos da conta.
- Pagamentos e alterações de valores usam transação e bloqueio da conta. O parcelamento é gravado em uma única transação e conserva os centavos.
- Cliente, categoria e conta são verificados na empresa autenticada. Contas canceladas ou quitadas não recebem novos pagamentos.
- Cancelar exige estornar os pagamentos. Contas com histórico não podem ser excluídas. Sincronizar propostas preserva valores já movimentados e contas canceladas.
- Indicadores contam os pagamentos reais, inclusive parciais. Estornos aparecem como reversão na data do estorno. O fluxo mostra realizado separado do pendente por vencimento.
- Fornecedor/pessoa a pagar pode ser informado como favorecido; ainda não é um cadastro separado de fornecedores.

## Atualização de banco

A migration `20261006130000_contas_pagamentos` e a preparação idempotente do servidor criam o histórico e migram as baixas existentes uma única vez. Uma antiga conta marcada paga com valor recebido menor que o total volta a ficar pendente, conservando a baixa conhecida. Históricos que já haviam sido apagados antes desta atualização não são reconstruídos.

A preparação corrige o índice global antigo de categorias para a chave empresa/nome/tipo. Dados antigos sem empresa não são atribuídos arbitrariamente; o vínculo é recuperado apenas quando existe uma proposta com empresa conhecida.

## Validação operacional

1. Criar uma conta de R$ 1.000 e registrar R$ 400: restante R$ 600 e saldo aumenta R$ 400.
2. Registrar R$ 600: conta quitada e total recebido R$ 1.000.
3. Estornar somente o primeiro pagamento com motivo: conta pendente R$ 400 e histórico preservado.
4. Repetir com conta a pagar: o saldo diminui com o pagamento e aumenta com o estorno.
5. Conferir categorias com o mesmo nome em duas empresas e tentar usar uma conta de outra empresa (deve recusar).

Recorrências, juros/multa/desconto, cadastro completo de fornecedores e transformação das condições comerciais em parcelas automáticas de propostas não integram esta etapa.
