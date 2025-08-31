---
applyTo: "**"
description: "Ferramentas que o agente pode propor e como confirmar"
---
Ferramentas do Agent Mode:

O agente pode invocar múltiplas ferramentas, editar arquivos, sugerir e pedir confirmação antes de executar comandos no terminal ou ferramentas não nativas. Confirmar antes de executar.

Invocação explícita:

Em qualquer modo de chat, referenciar uma ferramenta com #nomeDaFerramenta no prompt.

Preferências:

Para lint/format, preferir ESLint + Prettier. Para tipos, preferir tsc --noEmit em CI. Para testes, jest e npx stryker run.

Segurança:

Solicitar confirmação explícita antes de comandos que alteram arquivos, dados ou estado; listar mudanças propostas.