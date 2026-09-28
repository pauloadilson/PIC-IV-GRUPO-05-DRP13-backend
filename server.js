const express = require('express');
const cors = require('cors');
const weatherRoutes = require('./src/routes/weatherRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// Log simples de requisições
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Rotas da API
app.use('/api/weather', weatherRoutes);

// Rota raiz e health check
app.get('/', (req, res) => {
  res.json({
    name: 'Viveiro Bioterra - Weather API Backend',
    version: '1.0.0',
    status: 'online',
    endpoints: {
      forecast: '/api/weather/forecast',
      history: '/api/weather/history'
    },
    docs: {
      forecast: 'Previsão do tempo atual e próximos dias via HG Brasil Weather API (com contingência)',
      history: 'Série histórica meteorológica INMET (2004 a 08/2026) com suporte a filtros'
    }
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
    console.log(` 🌱 Viveiro Bioterra - API Backend rodando com sucesso!`);
    console.log(` 🌐 Servidor escutando na porta: ${PORT}`);
    console.log(` 📡 Previsão HG Brasil: http://localhost:${PORT}/api/weather/forecast`);
    console.log(` 📊 Histórico INMET:    http://localhost:${PORT}/api/weather/history`);
    console.log(`=======================================================`);
  });
}

module.exports = app;
