# Perfis por empresa

Cada login herda a configuração da sua empresa, mantendo as permissões por função. O perfil PADRAO mantém os campos, telas e documento da NEW FLOOR. Apenas a empresa com nome ou slug exatamente SBA recebe o perfil SBA automaticamente quando ainda não tem configuração.

O SUPER_ADMIN usa Empresas > Configurar sistema para escolher PADRAO, SBA ou PERSONALIZADO, módulos, campos e recursos. A API bloqueia módulos desabilitados e ignora campos desabilitados. As dependências entre módulos são validadas.

## SBA

- Clientes: códigos da reforma tributária, como registro cadastral sem cálculo fiscal automático.
- Propostas: contato e e-mail selecionados dentre os contatos do cliente; envio usa o e-mail escolhido como padrão.
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
