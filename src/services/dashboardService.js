const axios = require('axios');
const mockForecast = require('../data/mockForecast');

// URLs da API coletora (pic-iv-api)
const PIC_API_URL = process.env.PIC_API_URL || process.env.COLLECTOR_API_URL || 'http://127.0.0.1:8000';
const REMOTE_PIC_API_URL = process.env.REMOTE_PIC_API_URL || 'https://pic-iv-api.vercel.app';
const PIC_API_KEY = process.env.PIC_API_KEY || process.env.COLLECTOR_API_KEY;

/**
 * Mapeia o condition_slug da HG Brasil para ícone do Bootstrap Icons
 */
function mapConditionIcon(slug = '') {
  const s = String(slug || '').toLowerCase();
  if (s.includes('rain') || s.includes('storm')) return 'bi-cloud-rain';
  if (s.includes('cloud')) return 'bi-cloud-sun';
  if (s.includes('clear_night') || s.includes('night')) return 'bi-moon-stars';
  if (s.includes('clear')) return 'bi-sun';
  return 'bi-cloud-sun';
}

/**
 * Transforma o retorno consolidado de `GET /meteorologia` da `pic-iv-api`
 * na estrutura consumida pelo Front-end (nos moldes do mockData.js),
 * tratando os dados como condições meteorológicas externas de referência para o viveiro.
 */
function transformMeteorologiaToDashboard(data, sourceLabel = 'pic_iv_api') {
  const atual = data.atual || {};
  const results = data.results || {};
  const historico = data.historico || {};
  const janela24h = historico.janela_24h || {};
  const janela72h = historico.janela_72h || {};
  const rawPrevisao = Array.isArray(data.previsao) && data.previsao.length > 0
    ? data.previsao
    : (Array.isArray(results.forecast) ? results.forecast : []);

  const hojaPrev = rawPrevisao[0] || {};
  const amanhaPrev = rawPrevisao[1] || {};

  // Dados atuais normalizados pela pic-iv-api (com fallback para results)
  const currentTemp = Number(atual.temperatura_c ?? results.temp ?? 26.0);
  const tempMaxToday = Number(atual.temperatura_max_c ?? hojaPrev.temperatura_max_c ?? hojaPrev.max ?? currentTemp);
  const tempMinToday = Number(atual.temperatura_min_c ?? hojaPrev.temperatura_min_c ?? hojaPrev.min ?? currentTemp);
  const currentHumidity = Number(atual.umidade_pct ?? results.humidity ?? 68.0);
  const currentRain = Number(atual.chuva_mm ?? results.rain ?? 0.0);
  const rainProbToday = Number(
    atual.probabilidade_chuva_pct ?? hojaPrev.probabilidade_chuva_pct ?? hojaPrev.rain_probability ?? 0
  );
  const cloudiness = Number(atual.nebulosidade_pct ?? results.cloudiness ?? 0);
  const windSpeedKmH = Number(
    atual.velocidade_vento_kmh ?? (parseFloat(results.wind_speedy) || 14.5)
  );
  const windDirection = atual.direcao_vento_cardeal || results.wind_cardinal || 'SE';
  const condition = atual.condicao || results.description || 'Parcialmente nublado';
  const conditionSlug = atual.condicao_slug || results.condition_slug || '';
  const conditionIcon = mapConditionIcon(conditionSlug);

  // Precipitação acumulada nas últimas 24h e 72h calculadas pelo calcular_resumo_historico da pic-iv-api
  const rain24h = Number(
    (historico.precipitacao_acumulada_24h_mm ?? janela24h.precipitacao_acumulada_mm ?? currentRain).toFixed(1)
  );
  const rain72h = Number(
    (historico.precipitacao_acumulada_72h_mm ?? janela72h.precipitacao_acumulada_mm ?? rain24h).toFixed(1)
  );
  const rainForecast48h = Number(
    (
      Number(hojaPrev.chuva_mm ?? hojaPrev.rain ?? 0) +
      Number(amanhaPrev.chuva_mm ?? amanhaPrev.rain ?? 0)
    ).toFixed(1)
  );
  const ventoMax72h = Number(janela72h.vento_max_kmh ?? windSpeedKmH);

  // Horário de referência
  const refInstant = data.instante_fonte || data.hora_referencia || new Date().toISOString();
  const refDateObj = new Date(refInstant);
  const lastUpdated = results.time || refDateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const formattedDate = refDateObj.toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // 1. Matriz de Riscos Climáticos Gerais (Condições Externas de Referência)
  const hasHailRisk = condition.toLowerCase().includes('granizo') || condition.toLowerCase().includes('tempestade');
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
        ? `Máxima externa prevista de ${tempMaxToday}°C em Álvares Machado. Atenção ao sombreamento e ventilação no viveiro.`
        : `Máxima externa prevista de ${tempMaxToday}°C. Condição térmica amena na região.`,
      value: `Máxima de ${tempMaxToday}°C hoje`
    },
    {
      id: "risk-precipitacao",
      name: "Precipitação Acumulada",
      status: (rain72h >= 35 || rainForecast48h >= 35) ? "Atenção Elevada" : ((rain24h > 5 || rainForecast48h > 5) ? "Moderada" : "Baixo Risco"),
      level: (rain72h >= 35 || rainForecast48h >= 35) ? "warning" : "success",
      icon: "bi-cloud-rain-heavy",
      description: `Acumulado observado: ${rain24h} mm (24h) e ${rain72h} mm (72h). Previsão para 48h: ${rainForecast48h} mm.`,
      value: `${rain24h} mm (24h) | ${rain72h} mm (72h)`
    },
    {
      id: "risk-ventania",
      name: "Ventania",
      status: (windSpeedKmH >= 30 || ventoMax72h >= 35) ? "Atenção a Rajadas" : "Condição Normal",
      level: (windSpeedKmH >= 30 || ventoMax72h >= 35) ? "warning" : "success",
      icon: "bi-wind",
      description: `Vento externo atual de ${windSpeedKmH} km/h (${windDirection}). Máxima registrada em 72h: ${ventoMax72h} km/h.`,
      value: `${windSpeedKmH} km/h médio`
    }
  ];

  // 2. Previsão dos próximos dias (usando os campos normalizados de extrair_previsao)
  const formattedForecast = rawPrevisao.slice(0, 5).map((f, index) => ({
    day: f.rotulo_dia || (index === 0 ? "Hoje" : (index === 1 ? "Amanhã" : (f.data || f.date))),
    weekday: f.dia_semana || f.weekday,
    max: Number(f.temperatura_max_c ?? f.max ?? tempMaxToday),
    min: Number(f.temperatura_min_c ?? f.min ?? tempMinToday),
    rainProb: Number(f.probabilidade_chuva_pct ?? f.rain_probability ?? 0),
    rainMm: Number(f.chuva_mm ?? f.rain ?? 0),
    icon: mapConditionIcon(f.condicao_slug || f.condition || ''),
    cond: f.condicao || f.description || ''
  }));

  // 3. Clima Geral (Condições Externas de Referência em Álvares Machado/SP)
  const generalWeather = {
    location: `${data.cidade || "Álvares Machado, SP"} (Referência externa para o Viveiro Bioterra)`,
    station: "HG Brasil",
    lastUpdated,
    date: formattedDate,
    current: {
      temp: currentTemp,
      tempMin: tempMinToday,
      tempMax: tempMaxToday,
      humidity: currentHumidity,
      rainMm: currentRain,
      rainProbability: rainProbToday,
      condition,
      conditionIcon,
      windSpeedKmH,
      windDirection,
      uvIndex: atual.periodo === 'noite' ? 0 : 7,
      pressureHpa: 1014
    },
    generalRisks,
    forecast: formattedForecast
  };

  // 4. Avaliação das Culturas frente às condições externas de referência
  const isAlfaceTempStress = currentTemp > 26 || tempMaxToday > 26;
  const isRosaHumStress = currentHumidity > 60;
  const isRosaColdStress = currentTemp < 14 || tempMinToday < 14;
  const isSalsinhaHumStress = currentHumidity > 75 || rain72h > 35 || rainForecast48h > 35;
  const isSalsinhaTempStress = currentTemp > 24 || tempMaxToday > 28;
  const dryStatusText = rain72h === 0
    ? "Sem chuva (últimas 72h)"
    : (rain24h === 0 ? "Sem chuva (últimas 24h)" : `${rain24h} mm nas últimas 24h`);

  const plants = [
    {
      id: "alface-solaris",
      name: "Alface Solaris",
      scientificName: "Lactuca sativa var. capitata (Solaris)",
      category: "Hortaliça Folhosa",
      badge: isAlfaceTempStress ? "Atenção: Stress Térmico" : "Condição Externa Favorável",
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
          accumulated: `${rain72h} mm (72h)`,
          icon: "bi-cloud-rain"
        },
        forecast: {
          condition: hojaPrev.condicao || hojaPrev.description || condition,
          tempMax: tempMaxToday,
          tempMin: tempMinToday,
          rainProb: `${rainProbToday}%`,
          icon: mapConditionIcon(hojaPrev.condicao_slug || hojaPrev.condition || conditionSlug)
        }
      },
      risks: [
        {
          id: "dias-nublados",
          name: "Dias Nublados",
          status: cloudiness >= 60 ? "Moderado" : "Baixo",
          level: cloudiness >= 60 ? "warning" : "success",
          badge: `${cloudiness}% nebulosidade`,
          value: `Nebulosidade atual: ${cloudiness}%`,
          description: "Nebulosidade externa de referência. Persistência de baixa luminosidade por mais de 3 dias pode induzir estiolamento.",
          icon: "bi-cloud-slash"
        },
        {
          id: "risco-stress",
          name: "Risco de Stress",
          status: isAlfaceTempStress ? "Atenção Térmica" : "Baixo",
          level: isAlfaceTempStress ? "danger" : "success",
          badge: isAlfaceTempStress ? "Stress Térmico Alto" : "Faixa Confortável",
          value: `Atual ${currentTemp}°C / Máx ${tempMaxToday}°C`,
          description: "Temperatura externa de referência acima de 26°C alerta para risco de pendoamento precoce e 'tipburn' (queima de bordas).",
          icon: "bi-exclamation-triangle"
        },
        {
          id: "tempo-sem-chuva",
          name: "Tempo Sem Chuva",
          status: "Normal",
          level: "success",
          badge: "Manejo de irrigação",
          value: dryStatusText,
          description: "Referência externa para acompanhamento da demanda evaporativa e ajuste de regas.",
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
      badge: isRosaHumStress ? "Monitoramento de Umidade" : (isRosaColdStress ? "Atenção: Frio Externo" : "Condição Favorável"),
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
          accumulated: `${rain24h} mm (24h)`,
          icon: "bi-cloud-sun"
        },
        forecast: {
          condition: hojaPrev.condicao || hojaPrev.description || condition,
          tempMax: tempMaxToday,
          tempMin: tempMinToday,
          rainProb: `${rainProbToday}%`,
          icon: mapConditionIcon(hojaPrev.condicao_slug || hojaPrev.condition || conditionSlug)
        }
      },
      risks: [
        {
          id: "risco-umidade-excessiva",
          name: "Risco de Humidade Excessiva",
          status: isRosaHumStress ? "Crítico / Atenção" : "Baixo",
          level: isRosaHumStress ? "danger" : "success",
          badge: isRosaHumStress ? "Risco de Apodrecimento Radicular" : "Umidade Adequada",
          value: `${currentHumidity}% UR (${isRosaHumStress ? 'Acima de 60%' : '30% - 60%'})`,
          description: "Umidade relativa externa acima de 60% reduz a taxa de secagem do substrato e favorece fungos no caudex.",
          icon: "bi-water"
        },
        {
          id: "tempo-sem-chuva",
          name: "Tempo Sem Chuva",
          status: rain24h === 0 ? "Favorável" : "Atenção",
          level: rain24h === 0 ? "success" : "warning",
          badge: "Favorável",
          value: dryStatusText,
          description: "Período seco na região favorece a secagem adequada do substrato e o fortalecimento radicular da Adenium.",
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
      badge: isSalsinhaHumStress ? "Atenção: Excesso Hídrico" : "Excelente Vigor Vegetativo",
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
          status: rain72h > 35 ? "Precipitação Externa Alta" : "Referência externa",
          level: rain72h > 35 ? "warning" : "success",
          accumulated: `${rain72h} mm (últimas 72h)`,
          icon: "bi-cloud-rain-heavy"
        },
        forecast: {
          condition: hojaPrev.condicao || hojaPrev.description || condition,
          tempMax: tempMaxToday,
          tempMin: tempMinToday,
          rainProb: `${rainProbToday}%`,
          icon: mapConditionIcon(hojaPrev.condicao_slug || hojaPrev.condition || conditionSlug)
        }
      },
      risks: [
        {
          id: "risco-umidade-excessiva",
          name: "Risco de Humidade Excessiva",
          status: isSalsinhaHumStress ? "Moderado / Alerta" : "Baixo",
          level: isSalsinhaHumStress ? "warning" : "success",
          badge: isSalsinhaHumStress ? "Risco de Podridão e Míldio" : "Faixa Segura",
          value: `${currentHumidity}% UR + ${rain72h}mm (72h)`,
          description: "Alta umidade externa (acima de 75%) e chuva acumulada na região alertam para risco de fungos de solo (Pythium/Rhizoctonia) e manchas foliares (Septoria).",
          icon: "bi-droplet-fill"
        },
        {
          id: "risco-temperatura-elevada",
          name: "Risco de Temperatura Elevada",
          status: isSalsinhaTempStress ? "Atenção" : "Baixo",
          level: isSalsinhaTempStress ? "warning" : "success",
          badge: isSalsinhaTempStress ? "Acima de 24°C" : "Clima Ameno Adequado",
          value: `${currentTemp}°C (Máx ${tempMaxToday}°C)`,
          description: "A temperatura externa de referência está dentro da faixa confortável (10°C a 24°C). Risco de retardo vegetativo caso supere 28°C.",
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
    origem_dados: data.origem_dados || sourceLabel,
    hora_referencia: data.hora_referencia || null,
    historico: {
      precipitacao_acumulada_24h_mm: rain24h,
      precipitacao_acumulada_72h_mm: rain72h,
      janela_24h: janela24h,
      janela_72h: janela72h
    },
    generalWeather,
    plants
  };
}

/**
 * Converte um lote de `/observacoes/24` ou `/observacoes/72` para o mesmo formato de `/meteorologia`
 * caso a instância consultada ainda não exponha `/meteorologia`.
 */
function convertObservacoesToMeteorologiaFormat(obsPayload) {
  const lista = Array.isArray(obsPayload?.observacoes) ? [...obsPayload.observacoes] : [];
  lista.sort((a, b) => new Date(a.hora_referencia || 0) - new Date(b.hora_referencia || 0));
  const ultima = lista[lista.length - 1] || {};
  let results = {};
  try {
    if (typeof ultima.resposta_original_json === 'string') {
      results = JSON.parse(ultima.resposta_original_json).results || {};
    }
  } catch (e) {
    // ignore
  }

  let rain72h = 0;
  let rain24h = 0;
  const len = lista.length;
  lista.forEach((item, idx) => {
    let r = 0;
    try {
      if (typeof item.resposta_original_json === 'string') {
        r = Number(JSON.parse(item.resposta_original_json).results?.rain || 0);
      }
    } catch (e) {
      // ignore
    }
    rain72h += r;
    if (idx >= Math.max(0, len - 24)) {
      rain24h += r;
    }
  });

  return {
    localidade_id: ultima.localidade_id || '458410',
    cidade: results.city || ultima.cidade || 'Álvares Machado, SP',
    hora_referencia: ultima.hora_referencia,
    instante_fonte: ultima.instante_fonte,
    origem_dados: 'observacoes_fallback',
    atual: {
      temperatura_c: ultima.temperatura_c ?? results.temp,
      temperatura_max_c: results.forecast?.[0]?.max,
      temperatura_min_c: results.forecast?.[0]?.min,
      umidade_pct: ultima.umidade_pct ?? results.humidity,
      chuva_mm: results.rain ?? 0,
      probabilidade_chuva_pct: results.forecast?.[0]?.rain_probability ?? 0,
      nebulosidade_pct: results.cloudiness ?? 0,
      velocidade_vento_kmh: parseFloat(results.wind_speedy) || 10,
      direcao_vento_cardeal: results.wind_cardinal || 'SE',
      condicao: results.description,
      condicao_slug: results.condition_slug,
      periodo: results.currently
    },
    previsao: results.forecast || [],
    historico: {
      precipitacao_acumulada_24h_mm: Number(rain24h.toFixed(1)),
      precipitacao_acumulada_72h_mm: Number(rain72h.toFixed(1))
    },
    results
  };
}

/**
 * Consulta o endpoint consolidado `GET /meteorologia` na `pic-iv-api`
 * (tentando primeiro local `http://127.0.0.1:8000` e depois Vercel `https://pic-iv-api.vercel.app`).
 */
async function fetchMeteorologiaFromPicApi({ dias = 5, max_idade_minutos = 60, forcar_coleta = false } = {}) {
  const headers = PIC_API_KEY ? { 'X-API-Key': PIC_API_KEY } : {};
  const params = { dias, max_idade_minutos, forcar_coleta };

  // 1. Tenta GET /meteorologia na instância local (http://127.0.0.1:8000)
  try {
    const response = await axios.get(`${PIC_API_URL}/meteorologia`, {
      params,
      headers,
      timeout: 4000
    });
    if (response.data && (response.data.atual || response.data.results)) {
      return { data: response.data, source: `pic_iv_api_local (${response.data.origem_dados || 'banco'})` };
    }
  } catch (err) {
    // Segue para tentativa remota
  }

  // 2. Tenta GET /meteorologia na instância remota (https://pic-iv-api.vercel.app)
  try {
    const remoteResp = await axios.get(`${REMOTE_PIC_API_URL}/meteorologia`, {
      params,
      headers,
      timeout: 5000
    });
    if (remoteResp.data && (remoteResp.data.atual || remoteResp.data.results)) {
      return { data: remoteResp.data, source: `pic_iv_api_vercel (${remoteResp.data.origem_dados || 'banco'})` };
    }
  } catch (err) {
    // Segue para fallback de /observacoes/72 caso /meteorologia ainda não esteja no deploy remoto
  }

  // 3. Fallback: consulta /observacoes/72 na pic-iv-api (local ou remota)
  for (const baseUrl of [PIC_API_URL, REMOTE_PIC_API_URL]) {
    try {
      const obsResp = await axios.get(`${baseUrl}/observacoes/72`, {
        headers,
        timeout: 4000
      });
      if (obsResp.data && Array.isArray(obsResp.data.observacoes) && obsResp.data.observacoes.length > 0) {
        return {
          data: convertObservacoesToMeteorologiaFormat(obsResp.data),
          source: 'pic_iv_api_observacoes'
        };
      }
    } catch (err) {
      // Tenta próximo
    }
  }

  // 4. Contingência final usando mockForecast local
  return {
    data: {
      cidade: mockForecast.results.city,
      origem_dados: 'fallback_mock',
      results: mockForecast.results,
      previsao: mockForecast.results.forecast,
      historico: {
        precipitacao_acumulada_24h_mm: 0,
        precipitacao_acumulada_72h_mm: 0
      }
    },
    source: 'fallback_mock'
  };
}

/**
 * Gera os dados completos para o Dashboard do Front-end a partir de `GET /meteorologia` da `pic-iv-api`.
 */
async function getDashboardData(options = {}) {
  const { data, source } = await fetchMeteorologiaFromPicApi(options);
  return transformMeteorologiaToDashboard(data, source);
}

module.exports = {
  getDashboardData,
  fetchMeteorologiaFromPicApi,
  transformMeteorologiaToDashboard
};
