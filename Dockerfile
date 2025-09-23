# --- ESTÁGIO DE BUILD ---
# Usamos uma imagem Node.js completa para ter acesso ao compilador TypeScript e às devDependencies.
# Especificar a versão (ex: 20) e usar a variante 'alpine' para imagens menores.
FROM node:22 AS build

# Define o diretório de trabalho dentro do contêiner.
WORKDIR /usr/src/app

# Copia os arquivos de dependência primeiro para aproveitar o cache do Docker.
# Esta camada só será reconstruída se o package.json ou package-lock.json mudar.
ENV NODE_OPTIONS="--max-old-space-size=4096"

COPY package*.json ./
RUN npm install

# Copia o restante do código-fonte da aplicação.
COPY . .

# Compila o código TypeScript para JavaScript.
RUN npm run build

# Remove as dependências de desenvolvimento para limpar a pasta node_modules.
RUN npm prune --production


# --- ESTÁGIO DE PRODUÇÃO ---
# Usamos uma imagem 'alpine' limpa e leve para a imagem final.
FROM node:22-alpine

# Define o diretório de trabalho.
WORKDIR /usr/src/app

# Cria um usuário não-root para executar a aplicação por segurança.
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && chown -R appuser:appgroup /usr/src/app
USER appuser

# Copia apenas os artefatos necessários do estágio de build.
# Isso resulta em uma imagem final muito menor e mais segura.
COPY --chown=appuser:appgroup --from=build /usr/src/app/package*.json ./
COPY --chown=appuser:appgroup --from=build /usr/src/app/node_modules ./node_modules
COPY --chown=appuser:appgroup --from=build /usr/src/app/dist ./dist

# Expõe a porta em que a aplicação irá rodar.
# (Assumindo que sua aplicação roda na porta 3333, ajuste se necessário).
EXPOSE 3333

# Define a variável de ambiente para garantir que a aplicação rode em modo de produção.
ENV NODE_ENV=production

# Comando para iniciar a aplicação.
# Usar a forma de array do CMD é a prática recomendada para lidar com sinais do sistema (graceful shutdown).
CMD [ "node", "dist/server.js" ]