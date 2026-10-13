# Gestão de obras — José

O módulo `obras` inicia desligado em todas as empresas, incluindo SBA e NEW FLOOR. Habilite apenas na empresa do José em Empresas > Configurar sistema > módulos > obras. Clientes e financeiro precisam estar habilitados. Não há seleção automática por nome, slug ou usuário.

## Implantação

Antes de habilitar, executar `npx prisma migrate deploy` e `npx prisma generate` na API. A migração 20261013010000_gestao_obras cria tabelas novas, sem modificar os registros dos módulos existentes, e adiciona a origem financeira OBRA para proteger os valores gerados. O servidor aplica apenas esta migração pendente no startup, com transação, bloqueio e checksum registrado no histórico Prisma. Nesse primeiro processamento habilita obras somente na empresa ID 5, nome Jose e slug construarty, preservando as outras opções. Reinícios posteriores não forçam a habilitação caso o administrador a desative.

## Operação

- Cadastre colaboradores e valores de diária. Cadastre obra e etapas cujo total corresponda ao contrato.
- Equipe e cronograma: a data do apontamento é a alocação efetiva. Registre 1 para presença, 0 para falta e frações para distribuição entre obras. O valor da diária fica congelado no primeiro apontamento. O fechamento por período gera contas a pagar por obra e colaborador. Apontamentos fechados não podem ser alterados.
- Despesas: gera uma conta a pagar, inicialmente em aberto. Registre o pagamento no financeiro existente. O custo da obra é o valor incorrido, independentemente do pagamento.
- Medições: informe o percentual acumulado de cada etapa. A diferença contra a última medição aprovada calcula o valor do período. Existe uma medição pendente por obra. Aprovar gera uma cobrança única. Recebimentos parciais usam o financeiro existente.
- PDF: identificação da empresa, cliente e obra, período, execução anterior/atual, valor incremental, fotos e aprovação. Downloads autenticados; não são publicados na pasta pública de propostas.

## Limites desta entrega

Não importa automaticamente o histórico da planilha, não calcula folha trabalhista nem impostos. Cronograma reflete apontamentos efetivos; planejamento futuro, edição/cancelamento de medições, ajustes contratuais, retenções e descontos ainda exigem evolução própria. Obra e etapas não têm edição após cadastro nesta primeira versão. O relatório não substitui nota fiscal. Uma proposta pode ser vinculada pela API; o formulário inicial seleciona cliente e contrato informado manualmente. Valores medidos e recebidos são separados. As fotos são armazenadas no banco nesta versão, até 12 imagens de 375 KB.

Não habilitar em outras empresas durante a validação do José. Validar uma obra real com diárias, despesa, medição e baixa parcial antes de ampliar o uso.
