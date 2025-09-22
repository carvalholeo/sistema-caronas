import { ipKeyGenerator } from 'express-rate-limit';
import { Request } from 'express';
import crypto from 'crypto';

function limiterKeyGenerator(req: Request) {
  // Garante que seu app.set('trust proxy', 1) está configurado para pegar o IP correto
  const realIp = req.ip;
  let key;

  if (req.user) {
    key = `${req.user}:${realIp}`;
  }

  // Pega o email do corpo da requisição. Se não vier, usa uma string vazia.
  const email = req.body.email || '';

  // Cria um hash da combinação para não expor dados e para normalizar o tamanho da chave.
  key = `${email}:${realIp}`;
  return crypto.createHash('sha256').update(key).digest('hex');
}

const loginKeyGenerator = (req: Request): string => {
  // Garante que seu app.set('trust proxy', 1) está configurado para pegar o IP correto
  const realIp = req.ip;

  // Pega o email do corpo da requisição. Se não vier, usa uma string vazia.
  const email = req.body.email || '';

  // Cria um hash da combinação para não expor dados e para normalizar o tamanho da chave.
  const key = `${email}:${realIp}`;
  return crypto.createHash('sha256').update(key).digest('hex');
};

export { loginKeyGenerator, limiterKeyGenerator };