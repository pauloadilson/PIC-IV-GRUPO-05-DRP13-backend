const express = require('express');
const cors = require('cors');
const weatherRoutes = require('./src/routes/weatherRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

// Origens permitidas do Front-end (separadas por vírgula no .env / Vercel)
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

// Chave de acesso exclusiva entre Front-end e Back-end
const BACKEND_API_KEY = (process.env.BACKEND_API_KEY || '').trim();
const VALIDAR_BACKEND_API_KEY = process.env.VALIDAR_BACKEND_API_KEY !== 'false';

// Configuração estrita de CORS
const corsOptions = {
  origin: (origin, callback) => {
    if (allowedOrigins.length === 0) {
      return callback(null, true);
    }
    const normalizedOrigin = origin ? origin.trim().replace(/\/$/, '') : '';
    if (normalizedOrigin && allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-API-Key']
};

app.use(cors(corsOptions));
app.use(express.json());

// Log simples de requisições
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

/**
 * Middleware de proteção das rotas da API:
 * 1. Verifica se a requisição partiu de uma origem autorizada do Front-end (ALLOWED_ORIGINS).
 * 2. Verifica a chave de API (X-API-Key === BACKEND_API_KEY) caso configurada.
 */
function protectFrontendOnly(req, res, next) {
  if (req.method === 'OPTIONS') {
    return next();
  }

  // 1. Validação de Origem / Referer quando ALLOWED_ORIGINS está definido
  if (allowedOrigins.length > 0) {
    const reqOrigin = (req.headers.origin || '').trim().replace(/\/$/, '');
    const reqReferer = (req.headers.referer || '').trim();
    const isOriginAllowed =
      (reqOrigin && allowedOrigins.includes(reqOrigin)) ||
      allowedOrigins.some((allowed) => reqReferer.startsWith(allowed));

    if (!isOriginAllowed) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado: origem não autorizada.'
      });
    }
  }

  // 2. Validação da chave de acesso do Front-end quando BACKEND_API_KEY está configurada
  if (VALIDAR_BACKEND_API_KEY && BACKEND_API_KEY) {
    const clientKey = (req.headers['x-api-key'] || '').trim();
    if (clientKey !== BACKEND_API_KEY) {
      return res.status(401).json({
        success: false,
        error: 'Acesso negado: chave de API inválida ou ausente.'
      });
    }
  }

  return next();
}

// Rotas da API protegidas para acesso exclusivo do Front-end
app.use('/api/weather', protectFrontendOnly, weatherRoutes);

// Rota raiz e health check
app.get('/', (req, res) => {
  res.json({
    name: 'Viveiro Bioterra - Weather API Backend',
    version: '1.1.0',
    status: 'online'
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Tratamento de rotas inexistentes (404)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Rota não encontrada'
  });
});

// Tratamento global de erros
app.use((err, req, res, next) => {
  console.error('Erro não tratado na aplicação:', err);
  res.status(500).json({
    success: false,
    error: 'Erro interno no servidor'
  });
});

// Inicia o servidor apenas se executado diretamente
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(` 🌱 Viveiro Bioterra - API Backend rodando na porta ${PORT}`);
    console.log(` 🔒 Origens permitidas: ${allowedOrigins.length ? allowedOrigins.join(', ') : 'Todas (dev)'}`);
    console.log(` 🔑 Proteção X-API-Key: ${VALIDAR_BACKEND_API_KEY && BACKEND_API_KEY ? 'ATIVA' : 'INATIVA'}`);
    console.log(`=======================================================`);
  });
}

module.exports = app;
