# Checklist de Problemas e Soluções para Testes

## Problemas Corrigidos

✅ **Configuração TypeScript**
- `tsconfig.test.json` atualizado com paths corretos
- `jest.config.js` configurado para usar `tsconfig.test.json`

✅ **Setup Simplificado**  
- Criado `tests/setup-simple.ts` sem MongoDB Memory Server
- Configurado mocks para mongoose
- Removida dependência pesada que pode travar os testes

✅ **Estrutura dos Testes**
- Removidas linhas em branco no início dos arquivos
- Padronizados imports e mocks
- Criados testes básicos para validação

## Possíveis Problemas Restantes

### 1. MongoDB Memory Server
**Sintoma**: Testes travando na inicialização
**Solução**: Usar setup simplificado (`setup-simple.ts`) em vez de `setup.ts`

### 2. Dependências Circulares
**Sintoma**: Imports que falham ou causam erro
**Solução**: Verificar imports nos arquivos `src/` e usar paths absolutos nos testes

### 3. Timeouts
**Sintoma**: Testes que não finalizam
**Solução**: Configurado `testTimeout: 30000` no Jest config

### 4. Handles Abertos
**Sintoma**: Jest não finaliza após testes
**Solução**: Usar `--detectOpenHandles --forceExit` nas opções do Jest

## Comandos para Diagnóstico

```bash
# Teste básico
npx jest tests/minimal.test.ts --no-coverage

# Teste com setup simplificado  
npx jest tests/unit/basic-security.test.ts --verbose

# Todos os testes com debug
npm test -- --detectOpenHandles --forceExit --testTimeout=10000

# Executar script de diagnóstico
chmod +x run-tests.sh && ./run-tests.sh
```

## Configurações de Emergência

### Jest Config Mínimo
Se os testes continuarem travando, use esta configuração:

```javascript
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testTimeout: 10000,
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  coverageDirectory: "coverage",
  // Sem setup files inicialmente
  moduleNameMapper: {
    "^@/(.*)": "<rootDir>/src/$1"
  }
};
```

### Package.json Scripts
```json
{
  "test:minimal": "jest tests/minimal.test.ts",
  "test:basic": "jest tests/unit/basic-security.test.ts",
  "test:debug": "jest --detectOpenHandles --forceExit"
}
```

## Status Atual

- ✅ Configurações corrigidas
- ✅ Setup simplificado criado  
- ✅ Testes básicos implementados
- ⏳ Aguardando execução para validar correções