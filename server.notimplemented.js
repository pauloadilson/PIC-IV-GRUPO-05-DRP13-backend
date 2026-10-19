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
    version: '1.1.0',
    status: 'online',
    endpoints: {
      dashboard: '/api/weather/dashboard?janela=24',
      observacoes24: '/api/weather/observacoes/24',
      observacoes72: '/api/weather/observacoes/72',
      forecast: '/api/weather/forecast',
      history: '/api/weather/history'
    },
    docs: {
      dashboard: 'Transforma as observações coletadas da HG Brasil (pic-iv-api) no formato consumido pelo Front-end',
      observacoes: 'Consome janela de 24h ou 72h da API coletora (pic-iv-api) e retorna dados transformados e brutos'
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
    console.log(` 📊 Dashboard Frontend: http://localhost:${PORT}/api/weather/dashboard`);
    console.log(` 🕒 Observações 24h:    http://localhost:${PORT}/api/weather/observacoes/24`);
    console.log(` 🕒 Observações 72h:    http://localhost:${PORT}/api/weather/observacoes/72`);
    console.log(`=======================================================`);
  });
}

module.exports = app;
