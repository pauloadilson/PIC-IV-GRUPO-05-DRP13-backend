const axios = require('axios');
const mockForecast = require('../data/mockForecast');

// URLs da API coletora (pic-iv-api) que persiste dados da HG Brasil
const LOCAL_COLLECTOR_URL = process.env.COLLECTOR_API_URL || 'http://127.0.0.1:8000';
const REMOTE_COLLECTOR_URL = process.env.REMOTE_COLLECTOR_API_URL || 'https://pic-iv-api.vercel.app';
const DEFAULT_WOEID = '458410'; // Álvares Machado, SP
const HG_BASE_URL = 'https://api.hgbrasil.com/weather';

/**
 * Extrai com segurança o objeto `results` da resposta original da HG Brasil
 * armazenada em `resposta_original_json` (string) ou `resposta_original` (objeto).
 */
function parseHgResults(obs) {
  if (!obs) return {};
  try {
    if (typeof obs.resposta_original_json === 'string') {
      const parsed = JSON.parse(obs.resposta_original_json);
      return parsed.results || parsed || {};
    }
    if (obs.resposta_original && typeof obs.resposta_original === 'object') {
      return obs.resposta_original.results || obs.resposta_original;
    }
  } catch (e) {
    console.warn('[WARN] Falha ao fazer parse de resposta_original_json:', e.message);
  }
  return {};
}

/**
 * Mapeia o condition_slug da HG Brasil para ícone do Bootstrap Icons
 */
function mapConditionIcon(slug = '') {
  if (slug.includes('rain') || slug.includes('storm')) return 'bi-cloud-rain';
  if (slug.includes('cloud')) return 'bi-cloud-sun';
  if (slug.includes('clear_night')) return 'bi-moon-stars';
  if (slug.includes('clear')) return 'bi-sun';
  return 'bi-cloud-sun';
}

/**
 * Transforma o payload de `/observacoes/24` ou `/observacoes/72` da API coletora (pic-iv-api)
 * na estrutura exata consumida pelo Front-end (nos moldes do mockData.js),
 * tratando os dados como condições meteorológicas externas de referência para o viveiro.
 */
function transformObservacoesToDashboard(observacoesPayload, sourceLabel = 'pic_iv_api') {
  const lista = Array.isArray(observacoesPayload?.observacoes)
    ? [...observacoesPayload.observacoes]
    : [];

  // Ordena cronologicamente pela hora_referencia ou instante_fonte para garantir que o último item seja o mais recente
  lista.sort((a, b) => {
    const tA = new Date(a.hora_referencia || a.instante_fonte || 0).getTime();
    const tB = new Date(b.hora_referencia || b.instante_fonte || 0).getTime();
    return tA - tB;
  });

  const ultimaObs = lista[lista.length - 1] || {};
  const hgResults = parseHgResults(ultimaObs);

  const currentTemp = Number(
    ultimaObs.temperatura_c ?? hgResults.temp ?? 24
  );
  const currentHumidity = Number(
    ultimaObs.umidade_pct ?? hgResults.humidity ?? 60
  );
  const currentRain = Number(hgResults.rain ?? 0);
  const windSpeedNumber = parseFloat(hgResults.wind_speedy) || 10;
  const windCardinal = hgResults.wind_cardinal || 'SO';
  const description = hgResults.description || 'Tempo limpo';
  const conditionIcon = mapConditionIcon(hgResults.condition_slug || '');

  // Estatísticas calculadas sobre a janela de observações (24h ou 72h)
  let totalRainObserved = 0;
  let hoursWithoutRain = 0;
  let cloudyHours = 0;
  let minTempWindow = currentTemp;
  let maxTempWindow = currentTemp;

  lista.forEach((obs) => {
    const res = parseHgResults(obs);
    const t = Number(obs.temperatura_c ?? res.temp ?? currentTemp);
    const rainVal = Number(res.rain ?? 0);
    const cloudVal = Number(res.cloudiness ?? 0);

    if (t < minTempWindow) minTempWindow = t;
    if (t > maxTempWindow) maxTempWindow = t;

    totalRainObserved += rainVal;
    if (rainVal === 0) hoursWithoutRain += 1;
    if (cloudVal >= 60) cloudyHours += 1;
  });

  totalRainObserved = Number(totalRainObserved.toFixed(1));
  const totalHoursWindow = lista.length || 24;

  // Previsão dos próximos dias presente no payload da HG Brasil
  const rawForecast = Array.isArray(hgResults.forecast) ? hgResults.forecast : [];
  const todayForecast = rawForecast[0] || {};
  const tomorrowForecast = rawForecast[1] || {};

  const tempMaxToday = Number(todayForecast.max ?? maxTempWindow);
  const tempMinToday = Number(todayForecast.min ?? minTempWindow);
  const rainForecast48h = Number(
    ((Number(todayForecast.rain) || 0) + (Number(tomorrowForecast.rain) || 0)).toFixed(1)
  );
  const maxWindGust = parseFloat(todayForecast.wind_gust || hgResults.wind_gust) || windSpeedNumber;

  // Horário da última observação
  const refDateObj = ultimaObs.instante_fonte ? new Date(ultimaObs.instante_fonte) : new Date();
  const lastUpdated = hgResults.time || refDateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const formattedDate = refDateObj.toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // 1. Matriz de Riscos Climáticos Gerais (Condições Externas de Referência)
  const hasHailRisk = description.toLowerCase().includes('granizo') || description.toLowerCase().includes('tempestade');
  const generalRisks = [
    {
      id: "risk-granizo",
      name: "Granizo",
      status: hasHailRisk ? "Atenção Crítica" : "Baixo Risco",
      level: hasHailRisk ? "danger" : "success",
      icon: "bi-cloud-snow",
      description: hasHailRisk
        ? "Condição atmosférica severa na região. Atenção às estruturas de proteção do viveiro."
        : "Sem indicação de precipitação de granizo na região nas próximas 24h.",
      value: hasHailRisk ? "Alerta Ativo" : "Sem ocorrência prevista"
    },
    {
      id: "risk-calor",
      name: "Calor Excessivo",
      status: tempMaxToday >= 32 ? "Alerta Crítico" : (tempMaxToday >= 28 ? "Atenção Moderada" : "Condição Normal"),
      level: tempMaxToday >= 32 ? "danger" : (tempMaxToday >= 28 ? "warning" : "success"),
      icon: "bi-thermometer-sun",
      description: tempMaxToday >= 28
        ? `Máxima externa prevista de ${tempMaxToday}°C em Álvares Machado. Atenção ao manejo de sombreamento e ventilação.`
        : `Máxima externa prevista de ${tempMaxToday}°C. Condição térmica amena na região.`,
      value: `Máxima de ${tempMaxToday}°C`
    },
    {
      id: "risk-precipitacao",
      name: "Precipitação Acumulada",
      status: rainForecast48h >= 35 ? "Atenção Elevada" : (rainForecast48h > 5 ? "Moderada" : "Baixo Risco"),
      level: rainForecast48h >= 35 ? "warning" : "success",
      icon: "bi-cloud-rain-heavy",
      description: rainForecast48h >= 35
        ? `Acumulado externo previsto de ${rainForecast48h} mm (48h). Atenção à drenagem e umidade relativa.`
        : `Observado: ${totalRainObserved} mm (${totalHoursWindow}h) | Previsto: ${rainForecast48h} mm (48h).`,
      value: `${rainForecast48h} mm (prev. 48h)`
    },
    {
      id: "risk-ventania",
      name: "Ventania",
      status: maxWindGust >= 35 ? "Atenção a Rajadas" : "Condição Normal",
      level: maxWindGust >= 35 ? "warning" : "success",
      icon: "bi-wind",
      description: maxWindGust >= 35
        ? `Vento atual de ${windSpeedNumber} km/h com rajadas previstas de até ${maxWindGust} km/h na região.`
        : `Vento externo de ${windSpeedNumber} km/h (${windCardinal}) em Álvares Machado.`,
      value: `${windSpeedNumber} km/h (raj. ${maxWindGust} km/h)`
    }
  ];

  // 2. Previsão dos próximos dias
  const formattedForecast = rawForecast.slice(0, 5).map((f, index) => ({
    day: index === 0 ? "Hoje" : (index === 1 ? "Amanhã" : f.date),
    weekday: f.weekday,
    max: f.max,
    min: f.min,
    rainProb: f.rain_probability ?? 0,
    rainMm: f.rain ?? 0,
    icon: mapConditionIcon(f.condition || ''),
    cond: f.description
  }));

  // 3. Objeto generalWeather nos moldes do mockData.js
  const generalWeather = {
    location: "Álvares Machado/SP (Referência externa para o Viveiro Bioterra)",
    station: "HG Brasil",
    lastUpdated,
    date: formattedDate,
    current: {
      temp: currentTemp,
      tempMin: tempMinToday,
      tempMax: tempMaxToday,
      humidity: currentHumidity,
      rainMm: currentRain,
      rainProbability: todayForecast.rain_probability ?? 0,
      condition: description,
      conditionIcon,
      windSpeedKmH: windSpeedNumber,
      windDirection: windCardinal,
      uvIndex: hgResults.currently === 'noite' ? 0 : 7,
      pressureHpa: 1014
    },
    generalRisks,
    forecast: formattedForecast
  };

  // 4. Avaliação das Culturas frente às condições meteorológicas externas de referência
  const isAlfaceTempStress = currentTemp > 26 || tempMaxToday > 26;
  const isRosaHumStress = currentHumidity > 60;
  const isRosaColdStress = currentTemp < 14 || tempMinToday < 14;
  const isSalsinhaHumStress = currentHumidity > 75 || rainForecast48h > 35;
  const isSalsinhaTempStress = currentTemp > 24 || tempMaxToday > 28;
  const cloudyRatio = cloudyHours / totalHoursWindow;

  const plants = [
    {
      id: "alface-solaris",
      name: "Alface Solaris",
      scientificName: "Lactuca sativa var. capitata (Solaris)",
      category: "Hortaliça Folhosa",
      badge: isAlfaceTempStress ? "Atenção: Calor Externo" : "Condição Externa Favorável",
      badgeLevel: isAlfaceTempStress ? "warning" : "success",
      image: "https://images.unsplash.com/photo-1556801712-76c8eb07bbc9?auto=format&fit=crop&w=600&q=80",
      description: "Variedade selecionada para cultivo protegido, suscetível a queimaduras nas bordas foliares em períodos de alta radiação e calor.",
      metrics: {
        humidity: {
          value: currentHumidity,
          unit: "%",
          status: currentHumidity >= 60 && currentHumidity <= 80 ? "Ideal" : (currentHumidity > 80 ? "Alta" : "Baixa"),
          level: currentHumidity >= 60 && currentHumidity <= 80 ? "success" : "warning",
          optimalRange: "60% - 80%",
          icon: "bi-droplet-half"
        },
        temperature: {
          value: currentTemp,
          unit: "°C",
          status: currentTemp > 25 ? "Elevada" : (currentTemp < 15 ? "Baixa" : "Ótima"),
          level: currentTemp > 25 ? "warning" : "success",
          optimalRange: "15°C - 25°C",
          icon: "bi-thermometer-half"
        },
        rain: {
          value: currentRain,
          unit: "mm",
          status: "Referência externa",
          level: "success",
          accumulated: `${totalRainObserved} mm (${totalHoursWindow}h)`,
          icon: "bi-cloud-rain"
        },
        forecast: {
          condition: todayForecast.description || description,
          tempMax: tempMaxToday,
          tempMin: tempMinToday,
          rainProb: `${todayForecast.rain_probability ?? 0}%`,
          icon: mapConditionIcon(todayForecast.condition || '')
        }
      },
      risks: [
        {
          id: "dias-nublados",
          name: "Dias Nublados",
          status: cloudyRatio > 0.5 ? "Moderado" : "Baixo",
          level: cloudyRatio > 0.5 ? "warning" : "success",
          badge: `${cloudyHours}h nubladas (${totalHoursWindow}h)`,
          value: `${cloudyHours}h de alta nebulosidade`,
          description: "Nebulosidade externa de referência. Persistência de baixa luminosidade por mais de 3 dias pode induzir estiolamento.",
          icon: "bi-cloud-slash"
        },
        {
          id: "risco-stress",
          name: "Risco de Stress",
          status: isAlfaceTempStress ? "Atenção Térmica" : "Baixo",
          level: isAlfaceTempStress ? "danger" : "success",
          badge: isAlfaceTempStress ? "Stress Térmico" : "Faixa Confortável",
          value: `Atual ${currentTemp}°C / Máx ${tempMaxToday}°C`,
          description: "Temperatura de referência acima de 26°C alerta para risco de pendoamento precoce e 'tipburn' (queima de bordas).",
          icon: "bi-exclamation-triangle"
        },
        {
          id: "tempo-sem-chuva",
          name: "Tempo Sem Chuva",
          status: "Normal",
          level: "success",
          badge: "Referência hídrica",
          value: `${hoursWithoutRain}h sem chuva (${totalHoursWindow}h)`,
          description: "Referência externa para acompanhamento da demanda evaporativa e ajuste da irrigação no viveiro.",
          icon: "bi-calendar-check"
        }
      ],
      recommendations: [
        "Reforçar ventilação e resfriamento no viveiro quando a temperatura externa superar 26°C.",
        "Utilizar tela de sombreamento nos horários de maior insolação (11h às 15h) para mitigar tipburn.",
        "Monitorar a aeração para manter a umidade relativa na faixa de referência de 60% a 80%."
      ],
      idealConditions: {
        temp: "15°C - 25°C (tolerante até 28°C em cultivo de verão)",
        humidity: "60% - 80%",
        light: "Alta luminosidade difusa (protegida contra radiação excessiva)",
        soilMoisture: "Substrato umedecido e oxigenado"
      }
    },
    {
      id: "Rosa-do-deserto",
      name: "Rosa do Deserto",
      scientificName: "Adenium obesum",
      category: "Planta Ornamental Suculenta",
      badge: isRosaHumStress ? "Atenção: Umidade Externa" : (isRosaColdStress ? "Atenção: Frio Externo" : "Condição Favorável"),
      badgeLevel: isRosaHumStress || isRosaColdStress ? "warning" : "success",
      image: "https://worldofsucculents.com/wp-content/uploads/2015/08/Adenium-obesum.jpg",
      description: "Planta suculenta de clima árido e caudex bulboso. Extremamente vulnerável ao apodrecimento de raízes sob umidade elevada e substrato encharcado.",
      metrics: {
        humidity: {
          value: currentHumidity,
          unit: "%",
          status: isRosaHumStress ? "Atenção (Alta)" : "Ideal",
          level: isRosaHumStress ? "warning" : "success",
          optimalRange: "30% - 60%",
          icon: "bi-droplet-half"
        },
        temperature: {
          value: currentTemp,
          unit: "°C",
          status: currentTemp >= 25 && currentTemp <= 35 ? "Ótima" : (currentTemp < 14 ? "Baixa (Alerta)" : "Amena"),
          level: currentTemp < 14 ? "danger" : (currentTemp < 25 ? "warning" : "success"),
          optimalRange: "25°C - 35°C",
          icon: "bi-thermometer-sun"
        },
        rain: {
          value: currentRain,
          unit: "mm",
          status: "Referência externa",
          level: "success",
          accumulated: `${totalRainObserved} mm (${totalHoursWindow}h)`,
          icon: "bi-cloud-sun"
        },
        forecast: {
          condition: todayForecast.description || description,
          tempMax: tempMaxToday,
          tempMin: tempMinToday,
          rainProb: `${todayForecast.rain_probability ?? 0}%`,
          icon: mapConditionIcon(todayForecast.condition || '')
        }
      },
      risks: [
        {
          id: "risco-umidade-excessiva",
          name: "Risco de Humidade Excessiva",
          status: isRosaHumStress ? "Atenção" : "Baixo",
          level: isRosaHumStress ? "danger" : "success",
          badge: isRosaHumStress ? "Risco de Apodrecimento" : "Umidade Adequada",
          value: `${currentHumidity}% UR (${isRosaHumStress ? '> 60%' : '30% - 60%'})`,
          description: "Umidade relativa externa acima de 60% reduz a taxa de secagem do substrato e favorece fungos no caudex.",
          icon: "bi-water"
        },
        {
          id: "tempo-sem-chuva",
          name: "Tempo Sem Chuva",
          status: hoursWithoutRain >= 20 ? "Favorável" : "Atenção",
          level: hoursWithoutRain >= 20 ? "success" : "warning",
          badge: "Condição Externa",
          value: `${hoursWithoutRain}h sem chuva (${totalHoursWindow}h)`,
          description: "Períodos secos na região favorecem a secagem completa do substrato e o fortalecimento radicular da Adenium.",
          icon: "bi-sun-fill"
        }
      ],
      recommendations: [
        "Suspender regas até que o substrato atinja dessecação superficial completa.",
        "Favorecer a circulação de ar em períodos com umidade externa superior a 60%.",
        "Manter sombreamento moderado (tela de 35%) na formação de mudas para potencializar o caudex sem induzir estiolamento."
      ],
      idealConditions: {
        temp: "25°C - 35°C (sensível ao frio severo < 14°C)",
        humidity: "30% - 60%",
        light: "Sol pleno a sombreamento moderado (tela de 35% na fase de mudas)",
        soilMoisture: "Substrato altamente drenável, seco entre as regas"
      }
    },
    {
      id: "salsinha",
      name: "Salsinha",
      scientificName: "Petroselinum crispum",
      category: "Erva Aromática / Condimento",
      badge: isSalsinhaHumStress ? "Atenção: Umidade Externa" : "Vigor Favorável",
      badgeLevel: isSalsinhaHumStress ? "warning" : "success",
      image: "https://tse4.mm.bing.net/th/id/OIP.e72F1lheQKDZUvUEhGN87gHaFj?r=0&rs=1&pid=ImgDetMain&o=7&rm=3",
      description: "Cultura herbácea de ciclo contínuo, aprecia solos ricos e úmidos, porém extremamente sensível ao abafamento por calor e ao excesso de água acumulada.",
      metrics: {
        humidity: {
          value: currentHumidity,
          unit: "%",
          status: currentHumidity > 75 ? "Atenção: Alta" : (currentHumidity >= 60 ? "Ideal" : "Baixa"),
          level: currentHumidity > 75 ? "warning" : "success",
          optimalRange: "60% - 75%",
          icon: "bi-droplet-half"
        },
        temperature: {
          value: currentTemp,
          unit: "°C",
          status: currentTemp >= 10 && currentTemp <= 24 ? "Perfeita" : (currentTemp > 28 ? "Elevada" : "Amena"),
          level: currentTemp > 28 ? "warning" : "success",
          optimalRange: "10°C - 24°C",
          icon: "bi-thermometer-half"
        },
        rain: {
          value: currentRain,
          unit: "mm",
          status: rainForecast48h > 35 ? "Precipitação Externa Alta" : "Referência externa",
          level: rainForecast48h > 35 ? "warning" : "success",
          accumulated: `${totalRainObserved} mm (${totalHoursWindow}h)`,
          icon: "bi-cloud-rain-heavy"
        },
        forecast: {
          condition: todayForecast.description || description,
          tempMax: tempMaxToday,
          tempMin: tempMinToday,
          rainProb: `${todayForecast.rain_probability ?? 0}%`,
          icon: mapConditionIcon(todayForecast.condition || '')
        }
      },
      risks: [
        {
          id: "risco-umidade-excessiva",
          name: "Risco de Humidade Excessiva",
          status: isSalsinhaHumStress ? "Moderado / Alerta" : "Baixo",
          level: isSalsinhaHumStress ? "warning" : "success",
          badge: isSalsinhaHumStress ? "Risco de Podridão e Míldio" : "Faixa Segura",
          value: `${currentHumidity}% UR + ${totalRainObserved}mm (${totalHoursWindow}h)`,
          description: "Alta umidade externa (acima de 75%) e chuva acumulada alertam para risco de fungos de solo (Pythium/Rhizoctonia) e manchas foliares (Septoria).",
          icon: "bi-droplet-fill"
        },
        {
          id: "risco-temperatura-elevada",
          name: "Risco de Temperatura Elevada",
          status: isSalsinhaTempStress ? "Atenção" : "Baixo",
          level: isSalsinhaTempStress ? "warning" : "success",
          badge: isSalsinhaTempStress ? "Acima de 24°C" : "Clima Ameno Adequado",
          value: `Atual ${currentTemp}°C / Máx ${tempMaxToday}°C`,
          description: "A faixa externa de referência confortável situa-se entre 10°C e 24°C. Temperaturas acima de 28°C reduzem o vigor vegetativo.",
          icon: "bi-thermometer"
        }
      ],
      recommendations: [
        "Controlar rigorosamente a irrigação e a drenagem dos canteiros para prevenir encharcamento e podridões radiculares.",
        "Realizar desbaste foliar preventivo e manter aeração constante em dias de alta umidade externa.",
        "Evitar irrigação foliar no período noturno para reduzir incidência de míldio e septoriose."
      ],
      idealConditions: {
        temp: "10°C - 24°C (temperaturas > 28°C reduzem o vigor)",
        humidity: "60% - 75%",
        light: "Meia-sombra a sol moderado",
        soilMoisture: "Solo úmido com boa capacidade de campo, estritamente sem encharcamento"
      }
    }
  ];

  return {
    source: sourceLabel,
    janela: observacoesPayload?.janela || totalHoursWindow,
    quantidade_observacoes: lista.length,
    primeiro_horario: observacoesPayload?.primeiro_horario || null,
    ultimo_horario: observacoesPayload?.ultimo_horario || ultimaObs.hora_referencia || null,
    generalWeather,
    plants
  };
}

/**
 * Busca observações da API coletora (`pic-iv-api`) nas janelas de 24h ou 72h.
 * Tenta primeiro a instância local (http://127.0.0.1:8000), depois a instância em nuvem
 * (https://pic-iv-api.vercel.app), e por fim converte o fallback local no mesmo formato.
 */
async function fetchCollectorObservacoes(janela = 24) {
  const windowHours = Number(janela) === 72 ? 72 : 24;
  const headers = {};
  if (process.env.COLLECTOR_API_KEY) {
    headers['X-API-Key'] = process.env.COLLECTOR_API_KEY;
  }

  // 1. Tenta API coletora local (127.0.0.1:8000)
  try {
    const localResp = await axios.get(`${LOCAL_COLLECTOR_URL}/observacoes/${windowHours}`, {
      headers,
      timeout: 3000
    });
    if (localResp.data && Array.isArray(localResp.data.observacoes) && localResp.data.observacoes.length > 0) {
      return { payload: localResp.data, source: 'pic_iv_api_local' };
    }
  } catch (err) {
    // Segue para tentativa remota
  }

  // 2. Tenta API coletora publicada na Vercel (https://pic-iv-api.vercel.app)
  try {
    const remoteResp = await axios.get(`${REMOTE_COLLECTOR_URL}/observacoes/${windowHours}`, {
      headers,
      timeout: 5000
    });
    if (remoteResp.data && Array.isArray(remoteResp.data.observacoes) && remoteResp.data.observacoes.length > 0) {
      return { payload: remoteResp.data, source: 'pic_iv_api_vercel' };
    }
  } catch (err) {
    console.warn(`[WARN] Não foi possível consultar pic-iv-api remota: ${err.message}`);
  }

  // 3. Tenta API HG Brasil direta caso configurada
  try {
    const hgResp = await axios.get(HG_BASE_URL, {
      params: { woeid: DEFAULT_WOEID, key: process.env.HGBRASIL_KEY },
      timeout: 4000
    });
    if (hgResp.data && hgResp.data.results) {
      const r = hgResp.data.results;
      const syntheticPayload = {
        janela: windowHours,
        quantidade: 1,
        primeiro_horario: new Date().toISOString(),
        ultimo_horario: new Date().toISOString(),
        observacoes: [
          {
            id: 1,
            localidade_id: DEFAULT_WOEID,
            cidade: "Álvares Machado",
            instante_fonte: new Date().toISOString(),
            hora_referencia: new Date().toISOString(),
            temperatura_c: r.temp,
            umidade_pct: r.humidity,
            resposta_original_json: JSON.stringify(hgResp.data),
            origem: "hg_brasil"
          }
        ]
      };
      return { payload: syntheticPayload, source: 'hg_brasil_direct' };
    }
  } catch (err) {
    // Continua para o fallback
  }

  // 4. Fallback local sintético estruturado como observação da pic-iv-api
  const r = mockForecast.results;
  const fallbackPayload = {
    janela: windowHours,
    quantidade: 1,
    primeiro_horario: new Date().toISOString(),
    ultimo_horario: new Date().toISOString(),
    observacoes: [
      {
        id: 1,
        localidade_id: DEFAULT_WOEID,
        cidade: "Álvares Machado",
        instante_fonte: new Date().toISOString(),
        hora_referencia: new Date().toISOString(),
        temperatura_c: r.temp,
        umidade_pct: r.humidity,
        resposta_original_json: JSON.stringify(mockForecast),
        origem: "fallback_mock"
      }
    ]
  };
  return { payload: fallbackPayload, source: 'fallback_mock' };
}

/**
 * Retorna os dados consolidados do dashboard a partir das observações coletadas da HG Brasil.
 */
async function getDashboardData({ janela = 24 } = {}) {
  const { payload, source } = await fetchCollectorObservacoes(janela);
  return transformObservacoesToDashboard(payload, source);
}

module.exports = {
  getDashboardData,
  fetchCollectorObservacoes,
  transformObservacoesToDashboard
};
