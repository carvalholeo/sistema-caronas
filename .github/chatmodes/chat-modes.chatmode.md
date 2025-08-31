---
description: 'Como operar no Agent Mode e no Chat Mode'
tools: ['codebase', 'usages', 'vscodeAPI', 'problems', 'changes', 'testFailure', 'terminalSelection', 'terminalLastCommand', 'openSimpleBrowser', 'fetch', 'findTestFiles', 'searchResults', 'githubRepo', 'extensions', 'editFiles', 'runNotebooks', 'search', 'new', 'runCommands', 'runTasks']
---
Agent Mode:

Usar quando a tarefa for complexa, com múltiplos passos e iterações. O agente determina arquivos, propõe comandos, monitora resultados e itera até concluir a meta, pedindo confirmação quando necessário.

Modo de uso:

Abrir Chat, selecionar Agent no seletor de modo, enviar o prompt de alto nível, revisar diffs e comandos sugeridos, aprovar ou recusar por etapa.

Ferramentas e contexto:

Ajustar ferramentas permitidas pelo ícone Tools do chat; o agente decide contexto e arquivos relevantes autonomamente.

Escopo:

Usar applyTo em .instructions.md para aplicar instruções automaticamente a tipos de arquivo específicos durante criação/edição.