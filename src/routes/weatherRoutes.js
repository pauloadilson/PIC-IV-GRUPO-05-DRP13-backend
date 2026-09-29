const express = require('express');
const axios = require('axios');
const mockForecast = require('../data/mockForecast');
const mockHistoryData = require('../data/mockHistory');

const router = express.Router();

// Configurações padrão para HG Brasil Weather
const DEFAULT_WOEID = '458410'; // Álvares Machado / Presidente Prudente - SP
const DEFAULT_HG_KEY = process.env.HGBRASIL_KEY;
const HG_BASE_URL = 'https://api.hgbrasil.com/weather';

/**
 * GET /api/weather/forecast
 * Retorna dados de previsão do tempo obtidos da API HG Brasil.
 * Caso a API externa falhe ou atinja o limite de requisições, faz fallback gracioso para mock.
 */
router.get('/forecast', async (req, res) => {
  const woeid = req.query.woeid || DEFAULT_WOEID;
  const key = req.query.key || DEFAULT_HG_KEY;
  const cityName = req.query.city_name;

  const params = {
    key,
    ...(cityName ? { city_name: cityName } : { woeid })
  };

  try {
    const response = await axios.get(HG_BASE_URL, {
      params,
      timeout: 5000
    });

    if (response.data && response.data.results) {
      return res.json({
        success: true,
        source: 'hg_brasil_api',
        data: response.data
      });
    }

    // Se a API retornou sem erro HTTP mas com erro de chave/dados
    return res.json({
      success: true,
      source: 'fallback_mock',
      warning: 'API HG Brasil retornou resposta sem resultados. Servindo dados mockados de contingência.',
      data: mockForecast
    });
  } catch (error) {
    console.warn(`[WARN] Falha ao consultar HG Brasil API (${error.message}). Retornando dados mockados de contingência.`);
    return res.json({
      success: true,
      source: 'fallback_mock',
      warning: `Não foi possível contatar a API HG Brasil (${error.message}). Servindo dados mockados de contingência.`,
      data: mockForecast
    });
  }
});

/**
 * GET /api/weather/history
 * Retorna dados históricos meteorológicos baseados nos padrões de medição do INMET.
 * Cobertura: 2004 até 08/2026.
 * Suporta filtros por:
 *  - year: ano específico (ex: 2024, 2026)
 *  - start_year / end_year: intervalo de anos
 *  - month: mês específico (1 a 12)
 *  - crop: cultura de interesse (alface_solaris, salsinha, Rosa_do_deserto)
 *  - summary: se "true", retorna apenas os resumos consolidados anuais
 */
router.get('/history', (req, res) => {
  try {
    const { year, start_year, end_year, month, crop, summary, limit } = req.query;

    let monthly = [...mockHistoryData.monthly_data];
    let yearlySummary = [...mockHistoryData.summary_by_year];

    // Filtro por ano específico
    if (year) {
      const yearNum = parseInt(year, 10);
      monthly = monthly.filter(item => item.year === yearNum);
      yearlySummary = yearlySummary.filter(item => item.year === yearNum);
    }

    // Filtro por intervalo de anos
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

    // Filtro por mês
    if (month) {
      const monthNum = parseInt(month, 10);
      monthly = monthly.filter(item => item.month === monthNum);
    }

    // Projeção por cultura, se requisitada
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

    // Limite de registros
    if (limit) {
      const limitNum = parseInt(limit, 10);
      if (!isNaN(limitNum) && limitNum > 0) {
        monthly = monthly.slice(0, limitNum);
      }
    }

    // Se o cliente pediu apenas o resumo anual
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
