const express = require('express');
const mockForecast = require('../data/mockForecast');
const mockHistoryData = require('../data/mockHistory');
const {
  getDashboardData,
  fetchMeteorologiaFromPicApi
} = require('../services/dashboardService');

const router = express.Router();

/**
 * GET /api/weather/dashboard
 * Consome `GET /meteorologia` da `pic-iv-api` (com proteção de cota e histórico 24h/72h)
 * e retorna o payload formatado para o Front-end (nos moldes do mockData.js).
 */
router.get('/dashboard', async (req, res) => {
  try {
    const dias = req.query.dias ? Number(req.query.dias) : 5;
    const max_idade_minutos = req.query.max_idade_minutos ? Number(req.query.max_idade_minutos) : 60;
    const forcar_coleta = req.query.forcar_coleta === 'true';

    const dashboard = await getDashboardData({ dias, max_idade_minutos, forcar_coleta });
    return res.json({
      success: true,
      ...dashboard
    });
  } catch (error) {
    console.error('[ERROR] Erro ao gerar dados do dashboard:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao gerar dados do painel meteorológico.'
    });
  }
});

/**
 * GET /api/weather/meteorologia (e alias GET /api/weather/forecast)
 * Repassa a consulta consolidada da `pic-iv-api` (`GET /meteorologia`),
 * incluindo `atual`, `previsao`, `historico` (24h e 72h) e `results`.
 */
router.get(['/meteorologia', '/forecast'], async (req, res) => {
  try {
    const dias = req.query.dias ? Number(req.query.dias) : 5;
    const max_idade_minutos = req.query.max_idade_minutos ? Number(req.query.max_idade_minutos) : 60;
    const forcar_coleta = req.query.forcar_coleta === 'true';

    const { data, source } = await fetchMeteorologiaFromPicApi({
      dias,
      max_idade_minutos,
      forcar_coleta
    });

    return res.json({
      success: true,
      source,
      data
    });
  } catch (error) {
    console.warn(`[WARN] Falha ao consultar pic-iv-api (${error.message}). Retornando mock de contingência.`);
    return res.json({
      success: true,
      source: 'fallback_mock',
      data: mockForecast
    });
  }
});

/**
 * GET /api/weather/history
 * Retorna dados históricos meteorológicos baseados nos padrões de medição do INMET (2004 até 08/2026).
 */
router.get('/history', (req, res) => {
  try {
    const { year, start_year, end_year, month, crop, summary, limit } = req.query;

    let monthly = [...mockHistoryData.monthly_data];
    let yearlySummary = [...mockHistoryData.summary_by_year];

    if (year) {
      const yearNum = parseInt(year, 10);
      monthly = monthly.filter(item => item.year === yearNum);
      yearlySummary = yearlySummary.filter(item => item.year === yearNum);
    }

    if (start_year) {
      const startNum = parseInt(start_year, 10);
      monthly = monthly.filter(item => item.year >= startNum);
      yearlySummary = yearlySummary.filter(item => item.year >= startNum);
    }
    if (end_year) {
      const endNum = parseInt(end_year, 10);
      monthly = monthly.filter(item => item.year <= endNum);
      yearlySummary = yearlySummary.filter(item => item.year <= endNum);
    }

    if (month) {
      const monthNum = parseInt(month, 10);
      monthly = monthly.filter(item => item.month === monthNum);
    }

    if (crop) {
      const cropKey = crop.toLowerCase().replace(/[\s-]/g, '_');
      monthly = monthly.map(item => ({
        id: item.id,
        year: item.year,
        month: item.month,
        period: item.period,
        temperature: item.temperature,
        precipitation: item.precipitation,
        humidity: item.humidity,
        wind: item.wind,
        crop_impact: item.crop_impacts ? item.crop_impacts[cropKey] || null : null
      }));
    }

    if (limit) {
      const limitNum = parseInt(limit, 10);
      if (!isNaN(limitNum) && limitNum > 0) {
        monthly = monthly.slice(0, limitNum);
      }
    }

    if (summary === 'true' || summary === '1') {
      return res.json({
        success: true,
        source: 'inmet_mock_history',
        station: mockHistoryData.station,
        total_years: yearlySummary.length,
        summary_by_year: yearlySummary
      });
    }

    return res.json({
      success: true,
      source: 'inmet_mock_history',
      station: mockHistoryData.station,
      period_coverage: {
        start: '2004-01-01',
        end: '2026-08-31'
      },
      total_records: monthly.length,
      summary_by_year: yearlySummary,
      data: monthly
    });
  } catch (error) {
    console.error('[ERROR] Erro ao processar dados históricos:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao consultar dados históricos do INMET.'
    });
  }
});

module.exports = router;
