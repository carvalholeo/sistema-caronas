---
applyTo: "**/*.ts"
description: "Padrões Node + TypeScript + Express + Jest + Supertest + Stryker"
---
When generating or editing TypeScript Express services:

Projeto:

Usar TypeScript estrito com tsconfig sensato (noImplicitAny, strictNullChecks). Estruturar src/ e tests/.

Express:

Separar app.ts (instancia/rotas) de server.ts (bootstrap). Validar input (zod ou express-validator).

Testes:

Usar Jest para unit (mocks) e Supertest para integração (rotas e middlewares). Cobrir cenários limites e tipos errados.

Mutação:

Configurar StrykerJS para garantir robustez dos testes. Não ignorar mutantes sem justificativa.

Erros:

Centralizar error handling middleware; testar casos lançáveis.

Scripts:

Incluir scripts npm: build, test, test:unit, test:integration, stryker, start, dev.
