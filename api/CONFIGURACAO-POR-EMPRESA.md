# Perfis por empresa

Cada login herda a configuração da sua empresa, mantendo as permissões por função. O perfil PADRAO mantém os campos, telas e documento da NEW FLOOR. Apenas a empresa com nome ou slug exatamente SBA recebe o perfil SBA automaticamente quando ainda não tem configuração.

O SUPER_ADMIN usa Empresas > Configurar sistema para escolher PADRAO, SBA ou PERSONALIZADO, módulos, campos e recursos. A API bloqueia módulos desabilitados e ignora campos desabilitados. As dependências entre módulos são validadas.

## SBA

- Clientes: códigos da reforma tributária, como registro cadastral sem cálculo fiscal automático.
- Propostas: contato e e-mail selecionados dentre os contatos do cliente; envio usa o e-mail escolhido como padrão. Nova proposta usa o mesmo editor de composição de Orçamentos, e propostas com composição são editadas nesse modal. Kanban exibe o resumo de custos, margem, lucro e destinatário. Orçamentos e Propostas atualizam o mesmo registro. Propostas antigas sem composição mantêm o editor anterior; Outras ações preserva o acesso ao gerenciamento e faturamento.
- Prioridade, origem, frete e validade em dias desabilitados. Data de validade permanece opcional. Escopo vazio omitido no PDF.
- Orçamentos substitui o acesso a Serviços, com composição interna por materiais e mão de obra. Materiais ganha tela própria, usando o catálogo de serviços da mesma empresa com metadados.
- Materiais: classificação, especificações, fornecedor, códigos fiscais, unidades, quantidades cadastrais, quatro tabelas de preço e até dez fotos. Não há movimentação automática de estoque.
- Cálculo no servidor: material = quantidade × custo; mão de obra = dias × pessoas × horas/dia × valor/hora; preço = custo total ÷ (1 − margem). Imposto é uma estimativa, sem alterar notas fiscais. Lucro desconta custo e imposto.
- PDF comercial SBA separado do modelo NEW FLOOR; custos e margem não aparecem. Escopo padrão contém as três frases solicitadas, inclusive IPI ISENTO, como texto comercial sem cálculo fiscal.
- A1 PFX/P12 até 1 MB: valida chave privada, certificado vigente e senha; criptografa arquivo e senha com AES-256-GCM vinculados à empresa emissora. Apenas ADMIN/SUPER_ADMIN podem enviar. Nunca retorna o conteúdo nas APIs fiscais. O envio não configura o certificado no provedor Focus.

## Banco e implantação

Migração idempotente em prisma/migrations/20261002220000_perfis_por_empresa. O servidor também garante estas colunas antes de atender requisições, acompanhando a estratégia existente do projeto. Prisma deve ser gerado durante o build.

Configure CERTIFICADO_ENCRYPTION_KEY como segredo estável para os certificados. Na ausência dele, utiliza JWT_SECRET; trocar o segredo sem recriptografar os certificados impede a recuperação futura. Não adicionar segredos ao Git.

Para José, crie a empresa com PERSONALIZADO e habilite os recursos necessários. O cadastro específico de processos e variações adicionais dependerá das regras que ele definir. As opções são por empresa, não configurações individuais por usuário.

## Validação

npm test, npx tsc --noEmit e verificação sintática dos scripts web. Testes usam mocks para banco e provedores; não enviam e-mails nem emitem documentos fiscais. Implantação e uso em produção devem ser verificados no ambiente real.

## E-mail gerenciado SBA

O cliente consulta seu remetente em Propostas > Remetente das propostas, sem preencher servidor, porta ou senha. A rota pública de gravação de SMTP foi removida. Contas individuais já autorizadas são preservadas como compatibilidade.

A operação provisiona no ambiente da API as chaves `SMTP_EMPRESA_2_HOST`, `SMTP_EMPRESA_2_PORT` (465 ou 587), `SMTP_EMPRESA_2_USER` e `SMTP_EMPRESA_2_PASS`, sem versionar valores secretos. O usuário SMTP deve corresponder ao e-mail cadastrado do usuário que envia. Credenciais incompletas ou de outra identidade bloqueiam o envio; não há fallback para o SMTP global/New Floor. O prefixo por empresa impede reutilizar contas de outros tenants. A resolução gerenciada aceita outros IDs, mas o fluxo público atual permanece exclusivo SBA para preservar os demais perfis.

Depois de provisionar, validar autenticação e uma entrega autorizada. O status “configurado” indica disponibilidade da configuração; não certifica entrega na caixa do destinatário. Sem autorização do provedor da caixa/domínio, não é possível garantir envio autenticado em nome do cliente apenas alterando o campo From.

## Composição por serviço (SBA)

Novos orçamentos SBA usam `composicaoCustos.versao = 2`. Cada serviço contém suas listas `materiais` e `maoObra`, quantidade comercial, margem, imposto estimado e modo de preço `AUTOMATICO` ou `MANUAL`. As quantidades dos materiais e as jornadas de mão de obra representam a execução da quantidade total daquele serviço. O automático calcula custo ÷ (1 − margem) ÷ quantidade e arredonda o valor unitário em centavos antes do subtotal. Imposto estimado é descontado do resultado, preservando a regra comercial anterior.

A API recalcula os custos e todos os valores; ignora totalizadores enviados pelo navegador. As listas globais são derivadas dos serviços para manter catálogo/fornecedores e validação de tenant, sem duplicar custos. Impostos são calculados por serviço e somados. O resumo geral usa margem e alíquota efetivas ponderadas. Os limites totais permanecem 100 serviços, 200 materiais e 100 linhas de mão de obra.

Orçamentos sem versão 2 mantêm o editor e cálculo anteriores. A ação explícita “Organizar custos por serviço” preserva os preços manuais e coloca inicialmente os custos legados no primeiro serviço, com aviso visível para revisão da distribuição. Nenhuma proposta existente é alterada ao apenas abri-la. O PDF recebe somente os itens comerciais, sem materiais, mão de obra interna, margem ou lucro. Outros perfis mantêm o formato anterior.
