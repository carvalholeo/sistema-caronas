---
applyTo: "**"
description: "Diretrizes globais do projeto para o Copilot Chat e Agent Mode"
---

Provide project context and coding guidelines that AI should follow when generating code, answering questions, or reviewing changes.

Step-by-Step Guides:

Produzir respostas com instruções claras, passo a passo, numeradas quando aplicável, para que tarefas possam ser executadas sem ambiguidade.

Code Writing Standards:

Entregar amostras de código completas, prontas para execução, com consistência de estilo (nomes, indentação, sintaxe) e coerência de fluxo lógico.

Comment Usage:

Evitar comentários de placeholder. Comentar apenas lógica complexa ou decisões não óbvias.

Code Organization:

Quebrar blocos grandes em funções ou módulos coesos. Agrupar funcionalidades relacionadas.

Code Analysis:

Ao revisar arquivos completos, analisar o arquivo inteiro (não apenas trechos) e fornecer feedback abrangente.

Stack padrão do projeto:

Sempre que não for explicitamente dito o contrário, gerar código para Node no ambiente de execução, com TypeScript, ExpressJS, Jest para testes unitários, Supertest para testes de integração e StrykerJS para testes de mutação. Perguntar antes de usar outra linguagem.

Testes obrigatórios:

Todo código deve vir com testes automatizados cobrindo limites, tipos inesperados e cenários de erro/lançamento.

Multiplicidade de soluções:

Quando útil, oferecer alternativas de implementação, explicando trade-offs e por que uma pode ser melhor em dado contexto.

Fontes de raciocínio:

Sempre referenciar a origem do padrão adotado (ex.: docs oficiais, convenções) em texto explicativo.

