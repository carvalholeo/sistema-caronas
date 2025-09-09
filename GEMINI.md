Diretrizes do Projeto Carona Legal
Este documento descreve a arquitetura, os princípios e as tecnologias que fundamentam o backend do projeto Carona Legal, servindo como um guia para o desenvolvimento contínuo.

1. Diretrizes Iniciais do Projeto
Tecnologias Principais
Backend: Node.js v22 (LTS) com TypeScript v5.9

Framework: Express.js v5.1 (LTS)

Banco de Dados: MongoDB com Mongoose ODM

Autenticação: JSON Web Tokens (JWT) com versionamento de sessão

Comunicação em Tempo Real: Socket.IO para chat e localização

Upload de Arquivos: Multer com arquitetura de provedores (local/S3)

Envio de E-mails: Nodemailer com templates Handlebars

Arquitetura e Design
O projeto segue uma arquitetura em camadas para separação de responsabilidades:

Rotas: Definem os endpoints da API.

Middlewares: Interceptam requisições para validação (express-validator), autenticação (authMiddleware), autorização (permissionMiddleware), rate limiting e idempotência.

Controladores: Orquestram o fluxo da requisição, validam a entrada e chamam os serviços.

Serviços: Contêm a lógica de negócio principal, interagindo com os modelos de dados.

Modelos: Definem os schemas do Mongoose, as validações de dados e a lógica de banco de dados.

Princípios de Segurança
Controle de Acesso Granular: O sistema utiliza um modelo RBAC estendido, onde cada ação administrativa é protegida por uma permissão explícita (ex: usuarios:banir).

Autenticação de Dois Fatores (2FA): Obrigatória para ações administrativas críticas, garantindo uma camada extra de segurança.

Idempotência: Todas as requisições POST, PATCH e PUT suportam uma chave de idempotência no cabeçalho para prevenir execuções duplicadas acidentais.

Segurança de Tokens: Os tokens de redefinição de senha são armazenados como hashes, e o JWT inclui um versionamento de sessão para permitir o logout global instantâneo.

Auditoria Imutável: Todas as ações sensíveis (administrativas ou de segurança) são registradas em uma coleção de logs centralizada e imutável.

2. Detalhes de Contexto e Decisões de Arquitetura (Pensamento do Gemini)
(Nota: Esta seção reflete minhas sugestões e o raciocínio por trás de algumas decisões arquitetônicas que tomamos, visando a escalabilidade e manutenibilidade do projeto.)

Padrão Strategy para Notificações e Armazenamento: A decisão de não colocar a lógica de envio (WebPush, S3, etc.) diretamente nos serviços principais foi intencional. Ao criar "provedores" que seguem uma interface comum, o sistema se torna extremamente extensível. Adicionar um novo canal de notificação (como SMS) ou um novo provedor de armazenamento (como Google Cloud Storage) se resume a criar um novo arquivo de provedor e registrá-lo no serviço principal, sem a necessidade de modificar a lógica de negócio existente. Isso segue os princípios SOLID e torna o sistema resiliente a mudanças.

Centralização de Logs de Auditoria: Inicialmente, poderíamos ter mantido um array auditHistory dentro de cada modelo (User, Ride, etc.). A mudança para um AuditLogModel centralizado foi uma decisão estratégica. Ela oferece uma fonte única da verdade para toda a auditoria, simplifica drasticamente as consultas de compliance (como "mostrar todas as ações do admin X") e mantém os modelos de negócio principais mais limpos e focados em seus próprios domínios.

"Lazy Updates" vs. Background Jobs: A discussão sobre a expiração de tokens de reset de senha é um ótimo exemplo de uma decisão de design importante. Em vez de criar um job complexo para varrer o banco e atualizar o status de tokens para EXPIRED, a abordagem de "verificação no momento do uso" é muito mais eficiente. A lógica de consulta (expiresAt: { $gt: new Date() }) já trata um token expirado como inválido. O índice TTL do MongoDB atua como um "lixeiro" complementar, limpando os dados obsoletos sem a necessidade de lógica de aplicação adicional. Esta abordagem reduz a complexidade e o consumo de recursos.

Idempotência via Middleware: Implementar a lógica de idempotência como um middleware global que se aplica a todas as rotas da API é a forma mais limpa de garantir consistência. Isso evita a repetição de código em cada controlador e garante que a funcionalidade possa ser ativada ou desativada em um único local, facilitando a manutenção e os testes.

3. Custom Prompt para Interações Futuras
Step-by-Step Guides: Provide clear and structured instructions for tasks, detailing each step in the process to ensure the user can follow along without confusion.

Code Writing Standards:

Strive to deliver complete code samples that can be executed without additional modifications.

Ensure consistency in coding style, including naming conventions, indentation, and syntax.

Aim for coherence in logic flow and functionality within the code.

Comment Usage:

Minimize the use of comments as placeholders within the code.

Use comments to explain complex logic or decisions that are not immediately obvious from the code itself.

Code Organization:

Break down large code blocks into manageable sections or functions to improve readability and maintainability.

Organize code logically, grouping related functionality together.

Code Analysis:

When reviewing a complete code file, conduct a comprehensive analysis of the entire content.

Avoid focusing solely on isolated snippets; consider the file to provide a more informed review or feedback.

Give detailed responses that thoroughly explain concepts, code logic, and implementation details.

As ever as possible, except when explicitly said, provide code using Node as programming language. If there’s a better language to do the same thing, ask me if I want to learn about that other way.

If necessary, provide more code snippets solving the same problem, always explaining, and providing reasoning and context for why some way is better than others.

Always try to provide a source from the thought that led you to some code snippet.

All the code generated must be provided with some automated, unit test cases, covering limit situations and non-obvious tests (as passing other types instead what the functions expecting to receive), including