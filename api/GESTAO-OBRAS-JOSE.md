# Gestão de obras — José / Construarty

Módulo habilitado somente na empresa ID 5, slug construarty. As outras empresas continuam com obras desabilitado. Toda rota exige autenticação, vínculo de empresa e módulo habilitado; alterações operacionais exigem ADMIN/SUPER_ADMIN e operações financeiras aceitam FINANCEIRO.

## Fluxo

1. Cadastre a obra, o cliente, as etapas e o contrato. É possível vincular uma proposta da mesma empresa/cliente.
2. Cadastre colaboradores e diárias. Alterações no cadastro não modificam valores históricos dos apontamentos.
3. Planeje a equipe por dia. Planejamento e diárias realizadas são separados; planejar não cria custos nem pagamentos.
4. Aponte presenças, faltas e frações de diária. A soma entre obras não pode exceder uma diária por pessoa/dia.
5. Feche um período (uma obra ou todas). O fechamento gera contas a pagar por colaborador/obra. Registre pagamentos parciais e estornos no financeiro.
6. Lance despesas vinculadas à obra e opcionalmente a um colaborador. Cancelamento exige ausência de pagamentos ativos e cancela também a conta a pagar.
7. Registre o percentual acumulado por etapa. A diferença contra a última medição aprovada calcula o valor do período. Corrija rascunhos antes de aprovar. Aprovação gera uma conta a receber única.
8. Para cancelar medição aprovada, estorne os recebimentos e cancele as medições posteriores dependentes. A medição original fica no histórico. Para corrigir, cancele e cadastre outra medição.
9. Para corrigir apontamentos já fechados, estorne o pagamento e reabra o fechamento; o lançamento anterior fica cancelado. Refeche após corrigir.

## Contratos e relatórios

O editor permite ajustar nome, endereço, responsável, prazo, status, etapas não medidas e contrato. Etapas com histórico de medição não podem ser renomeadas, removidas ou ter valor alterado; aditivos usam novas etapas. Cliente e proposta ficam fixos após medição. O total das etapas deve corresponder ao contrato vigente.

As consultas têm busca, período e paginação de 15 registros. Há histórico das alterações com usuário e data. Fotos são omitidas dos snapshots do histórico para manter a consulta legível.

O relatório consolidado separa contrato, execução, custos incorridos e caixa. Execução acumulada até o fim do período, custos e pagamentos do período; saldos em aberto mostram a posição atual. Downloads são autenticados. Medição e relatório não substituem nota fiscal.

## Importação XLSX

A prévia lê Controle Quinzenal, CRONOGRAMA e GASOLINA, sem gravar. O ano das datas sem ano é informado pelo operador. Datas que atravessam dezembro/janeiro respeitam a virada do ano. Apelidos e colunas de obras exigem revisão/vínculo explícito ou opção de ignorar. É possível ajustar a obra de cada linha de presença/combustível e frações das alocações planejadas na prévia paginada.

Cadastro pode criar colaboradores da aba da quinzena ou reutilizar registros existentes. Presenças viram apontamentos realizados; cronograma vira planejamento; combustível vira despesa e conta a pagar em aberto. Não presume pagamentos efetuados. Datas ausentes, células incompletas e marcadores desconhecidos geram avisos. Registros existentes não são sobrescritos. Cada linha importada é identificada pelo arquivo/aba/célula/empresa para evitar duplicação na reimportação do mesmo arquivo. Importação inválida é revertida por transação.

A planilha fornecida foi lida: 19 colaboradores, 152 presenças/faltas, 1.108 alocações, 122 despesas e 9 avisos. Esses dados ainda exigem revisão de vínculos na tela e não são importados automaticamente.

## Migrações e validação

O startup aplica somente as migrações 20261013010000_gestao_obras e 20261013020000_operacao_obras, com bloqueio, transação e checksum registrado em _prisma_migrations. Não reaplica migrações antigas que outros módulos garantem em seus próprios serviços. A ativação inicial é restrita a ID/nome/slug do José e não volta a ligar um módulo que o administrador desativou posteriormente.

O smoke test da operação completa executa uma vez por versão no banco/Chrome da Render: planejamento, apontamento, fechamento, pagamento parcial, correção de medição, cobrança idempotente, recebimento parcial, PDF, estorno e cancelamento. Dados de teste são revertidos integralmente; somente um marcador técnico de validação fica em ImportacaoObra. Se a validação falhar, a nova versão não passa a atender solicitações.

Esta entrega não calcula folha trabalhista, encargos, retenções contratuais nem tributos. Valores de contrato são informados pelo usuário.
