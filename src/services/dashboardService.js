const axios = require('axios');
const mockForecast = require('../data/mockForecast');

const DEFAULT_WOEID = '458410'; // Álvares Machado / Presidente Prudente - SP
const HG_BASE_URL = 'https://api.hgbrasil.com/weather';

/**
 * Avalia e monta os dados consolidados do dashboard a partir da previsão da HG Brasil
 * aplicando os parâmetros agronômicos científicos validados na pesquisa bibliográfica.
 */
async function getDashboardData({ woeid = DEFAULT_WOEID, key = process.env.HGBRASIL_KEY } = {}) {
  let weatherRaw = null;
  let source = 'hg_brasil_api';

  try {
    const response = await axios.get(HG_BASE_URL, {
      params: { key, woeid },
      timeout: 5000
    });

    if (response.data && response.data.results) {
      weatherRaw = response.data.results;
    } else {
      source = 'fallback_mock';
      weatherRaw = mockForecast.results;
    }
  } catch (err) {
    console.warn(`[WARN] Usando mockForecast no dashboard: ${err.message}`);
    source = 'fallback_mock';
    weatherRaw = mockForecast.results;
  }

  const currentTemp = Number(weatherRaw.temp) || 26.5;
  const currentHumidity = Number(weatherRaw.humidity) || 68;
  const currentRain = Number(weatherRaw.rain) || 0;
  const windSpeedNumber = parseFloat(weatherRaw.wind_speedy) || 15;
  const todayForecast = weatherRaw.forecast && weatherRaw.forecast[0] ? weatherRaw.forecast[0] : {};
  const tomorrowForecast = weatherRaw.forecast && weatherRaw.forecast[1] ? weatherRaw.forecast[1] : {};

  const tempMaxToday = todayForecast.max || currentTemp + 4;
  const tempMinToday = todayForecast.min || currentTemp - 6;
  const rain48h = (Number(todayForecast.rain) || 0) + (Number(tomorrowForecast.rain) || 0);

  // 1. Matriz de Riscos Gerais
  const generalRisks = [
    {
      id: "risk-granizo",
      name: "Granizo",
      status: weatherRaw.description.toLowerCase().includes('granizo') ? "Atenção Crítica" : "Baixo Risco",
      level: weatherRaw.description.toLowerCase().includes('granizo') ? "danger" : "success",
      icon: "bi-cloud-snow",
      description: weatherRaw.description.toLowerCase().includes('granizo')
        ? "Probabilidade iminente de precipitação sólida. Proteger estufas."
        : "Sem probabilidade de precipitação de pedras de gelo nas próximas 24h.",
      value: weatherRaw.description.toLowerCase().includes('granizo') ? "Alerta Ativo" : "5% de probabilidade"
    },
    {
      id: "risk-calor",
      name: "Calor Excessivo",
      status: tempMaxToday >= 32 ? "Alerta Crítico" : (tempMaxToday >= 30 ? "Atenção Moderada" : "Condição Normal"),
      level: tempMaxToday >= 32 ? "danger" : (tempMaxToday >= 30 ? "warning" : "success"),
      icon: "bi-thermometer-sun",
      description: tempMaxToday >= 30 
        ? `Pico de ${tempMaxToday}°C previsto para hoje. Recomenda-se acionar telas de sombreamento e nebulização.`
        : `Temperatura máxima amena prevista de ${tempMaxToday}°C. Condições confortáveis para estufas.`,
      value: `Máxima de ${tempMaxToday}°C hoje`
    },
    {
      id: "risk-precipitacao",
      name: "Precipitação Acumulada",
      status: rain48h >= 40 ? "Atenção Elevada" : (rain48h >= 15 ? "Moderada" : "Baixo Risco"),
      level: rain48h >= 40 ? "warning" : "success",
      icon: "bi-cloud-rain-heavy",
      description: rain48h >= 30
        ? `Acumulado previsto de ${rain48h}mm nas próximas 48h. Risco de saturação hídrica em canteiros externos e calhas.`
        : `Precipitação baixa prevista (${rain48h}mm em 48h). Sem risco de encharcamento.`,
      value: `${rain48h} mm / 48h`
    },
    {
      id: "risk-ventania",
      name: "Ventania",
      status: windSpeedNumber >= 35 ? "Alerta de Rajadas" : "Condição Normal",
      level: windSpeedNumber >= 35 ? "danger" : "success",
      icon: "bi-wind",
      description: windSpeedNumber >= 35
        ? `Ventos fortes com rajadas de até ${windSpeedNumber} km/h. Verificar fixação de plásticos e cortinas das estufas.`
        : `Rajadas brandas de ${windSpeedNumber} km/h. Estruturas das estufas seguras e estáveis.`,
      value: `${windSpeedNumber} km/h médio`
    }
  ];

  // 2. Previsão consolidada
  const formattedForecast = (weatherRaw.forecast || []).slice(0, 5).map((f, index) => ({
    day: index === 0 ? "Hoje" : (index === 1 ? "Amanhã" : f.weekday),
    weekday: f.weekday,
    max: f.max,
    min: f.min,
    rainProb: f.rain_probability || 0,
    rainMm: f.rain || 0,
    icon: f.rain > 5 ? "bi-cloud-rain" : (f.rain > 0 ? "bi-cloud-drizzle" : "bi-cloud-sun"),
    cond: f.description
  }));

  // 3. Montagem do Clima Geral
  const generalWeather = {
    location: `${weatherRaw.city || "Álvares Machado, SP"} - Viveiro Bioterra`,
    station: `Estação Integrada (BFF INMET A707 / HG Brasil) [${source}]`,
    lastUpdated: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    date: new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    current: {
      temp: currentTemp,
      tempMin: tempMinToday,
      tempMax: tempMaxToday,
      humidity: currentHumidity,
      rainMm: currentRain,
      rainProbability: todayForecast.rain_probability || 20,
      condition: weatherRaw.description || "Parcialmente Nublado",
      conditionIcon: "bi-cloud-sun",
      windSpeedKmH: windSpeedNumber,
      windDirection: weatherRaw.wind_cardinal || "SE",
      uvIndex: 7,
      pressureHpa: 1014
    },
    generalRisks,
    forecast: formattedForecast
  };

  // 4. Avaliação Agronômica Dinâmica das Culturas (Parâmetros científicos)
  const isAlfaceStress = currentTemp > 26;
  const isSalsinhaHumStress = currentHumidity > 75 || rain48h > 35;
  const isRosaHumStress = currentHumidity > 60;

  const plants = [
    {
      id: "alface-solaris",
      name: "Alface Solaris",
      scientificName: "Lactuca sativa var. capitata (Solaris)",
      category: "Hortaliça Folhosa",
      greenhouse: "Estufa 01 - Hidroponia e Bancadas",
      badge: isAlfaceStress ? "Atenção: Stress Térmico" : "Condições Confortáveis",
      badgeLevel: isAlfaceStress ? "warning" : "success",
      image: "https://images.unsplash.com/photo-1556801712-76c8eb07bbc9?auto=format&fit=crop&w=600&q=80",
      description: "Cultivar selecionada para cultivo protegido em verão. Exige controle térmico rigoroso para evitar queima de bordas e floração precoce.",
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
          status: currentTemp > 26 ? "Elevada" : (currentTemp < 15 ? "Baixa" : "Ótima"),
          level: currentTemp > 26 ? "warning" : "success",
          optimalRange: "15°C - 25°C",
          icon: "bi-thermometer-half"
        },
        rain: {
          value: currentRain,
          unit: "mm",
          status: "Sob controle (Estufa)",
          level: "success",
          accumulated: `${rain48h} mm (48h)`,
          icon: "bi-cloud-rain"
        },
        forecast: {
          condition: todayForecast.description || "Pancadas à tarde e calor",
          tempMax: tempMaxToday,
          tempMin: tempMinToday,
          rainProb: `${todayForecast.rain_probability || 30}%`,
          icon: "bi-cloud-sun"
        }
      },
      risks: [
        {
          id: "dias-nublados",
          name: "Dias Nublados",
          status: (todayForecast.cloudiness || 20) > 70 ? "Alerta" : "Normal",
          level: (todayForecast.cloudiness || 20) > 70 ? "warning" : "success",
          badge: (todayForecast.cloudiness || 20) > 70 ? "Radiação Baixa" : "Radiação Adequada",
          value: `${todayForecast.cloudiness || 20}% nebulosidade`,
          description: "Radiação reduzida. Persistência de baixa luminosidade por mais de 3 dias induz estiolamento das folhas.",
          icon: "bi-cloud-slash"
        },
        {
          id: "risco-stress",
          name: "Risco de Stress",
          status: isAlfaceStress ? "Atenção Térmica" : "Normal",
          level: isAlfaceStress ? "danger" : "success",
          badge: isAlfaceStress ? "Stress Térmico Ativo" : "Faixa Confortável",
          value: `${currentTemp}°C (${isAlfaceStress ? 'T > 26°C' : 'Faixa Ótima'})`,
          description: "Temperaturas acima de 26°C induzem pendoamento precoce e aumentam o risco de 'tipburn' (queima das bordas foliares).",
          icon: "bi-exclamation-triangle"
        },
        {
          id: "tempo-sem-chuva",
          name: "Tempo Sem Chuva",
          status: "Normal",
          level: "success",
          badge: "Irrigação ativa",
          value: currentRain === 0 ? "Sem chuva hoje" : "Chuva registrada",
          description: "Cultivo protegido por fertirrigação contínua. Sem impacto direto de estiagem externa.",
          icon: "bi-calendar-check"
        }
      ],
      recommendations: [
        "Ligar nebulizadores para reduzir temperatura interna na estufa caso T > 26°C.",
        "Acionar tela de sombreamento (sombrite) nos horários de maior incidência solar (11h às 15h) para mitigar tipburn.",
        "Garantir aeração lateral e zenital (janelas/lanternim) para manter a umidade relativa entre 60% e 80%."
      ],
      idealConditions: {
        temp: "15°C - 25°C (tolerante até 28°C em cultivo de verão)",
        humidity: "60% - 80%",
        light: "Alta luminosidade difusa (protegida contra radiação excessiva)",
        soilMoisture: "Substrato hidropônico umedecido e oxigenado"
      }
    },
    {
      id: "Rosa-do-deserto",
      name: "Rosa do Deserto",
      scientificName: "Adenium obesum",
      category: "Planta Ornamental Suculenta",
      greenhouse: "Estufa 03 - Setor Árido",
      badge: isRosaHumStress ? "Atenção: Umidade Alta" : "Clima Favorável",
      badgeLevel: isRosaHumStress ? "warning" : "success",
      image: "https://worldofsucculents.com/wp-content/uploads/2015/08/Adenium-obesum.jpg",
      description: "Planta suculenta de clima árido e caudex bulboso. Extremamente vulnerável ao apodrecimento de raízes em solos encharcados e umidade excessiva.",
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
          status: currentTemp >= 25 && currentTemp <= 35 ? "Ótima" : (currentTemp < 14 ? "Frio Crítico" : "Ameno"),
          level: currentTemp < 14 ? "danger" : "success",
          optimalRange: "25°C - 35°C",
          icon: "bi-thermometer-sun"
        },
        rain: {
          value: 0.0,
          unit: "mm",
          status: "Sem chuva direta",
          level: "success",
          accumulated: "0 mm (Protegida)",
          icon: "bi-cloud-sun"
        },
        forecast: {
          condition: todayForecast.description || "Sol entre nuvens",
          tempMax: tempMaxToday,
          tempMin: tempMinToday,
          rainProb: `${todayForecast.rain_probability || 20}%`,
          icon: "bi-sun"
        }
      },
      risks: [
        {
          id: "risco-umidade-excessiva",
          name: "Risco de Humidade Excessiva",
          status: isRosaHumStress ? "Atenção" : "Baixo Risco",
          level: isRosaHumStress ? "danger" : "success",
          badge: isRosaHumStress ? "Risco de Apodrecimento Radicular" : "Umidade Segura",
          value: `${currentHumidity}% UR (${isRosaHumStress ? '> 60% Alerta' : 'Seguro'})`,
          description: "Umidade relativa acima de 60% combinada com substrato úmido favorece infecções fúngicas e apodrecimento no caudex.",
          icon: "bi-water"
        },
        {
          id: "tempo-sem-chuva",
          name: "Tempo Sem Chuva",
          status: "Ideal",
          level: "success",
          badge: "Favorável",
          value: currentRain === 0 ? "Ambiente seco" : "Chuva externa",
          description: "Período seco excelente para a secagem do substrato e fortalecimento radicular da Adenium.",
          icon: "bi-sun-fill"
        }
      ],
      recommendations: [
        "Suspender regas até que o substrato atinja dessecação superficial completa.",
        "Aumentar ventilação cruzada na estufa para baixar a umidade relativa do ar para a faixa de 30% a 60%.",
        "Manter sombreamento moderado (tela de 35%) na formação de mudas para potencializar desenvolvimento do caudex sem induzir estiolamento."
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
      greenhouse: "Canteiro Coberto 02 - Horta Fina",
      badge: isSalsinhaHumStress ? "Atenção: Excesso Hídrico" : "Excelente Vigor Vegetativo",
      badgeLevel: isSalsinhaHumStress ? "warning" : "success",
      image: "https://tse4.mm.bing.net/th/id/OIP.e72F1lheQKDZUvUEhGN87gHaFj?r=0&rs=1&pid=ImgDetMain&o=7&rm=3",
      description: "Cultura herbácea de ciclo contínuo, aprecia solos ricos e úmidos, porém extremamente sensível ao abafamento por calor e excesso de água acumulada.",
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
          status: currentTemp >= 10 && currentTemp <= 24 ? "Perfeita" : (currentTemp > 28 ? "Elevada" : "Ameno"),
          level: currentTemp > 28 ? "warning" : "success",
          optimalRange: "10°C - 24°C",
          icon: "bi-thermometer-half"
        },
        rain: {
          value: currentRain,
          unit: "mm",
          status: rain48h > 35 ? "Precipitação Acumulada Alta" : "Sob controle",
          level: rain48h > 35 ? "warning" : "success",
          accumulated: `${rain48h} mm (48h)`,
          icon: "bi-cloud-rain-heavy"
        },
        forecast: {
          condition: todayForecast.description || "Tempo ameno",
          tempMax: tempMaxToday,
          tempMin: tempMinToday,
          rainProb: `${todayForecast.rain_probability || 40}%`,
          icon: "bi-cloud-drizzle"
        }
      },
      risks: [
        {
          id: "risco-umidade-excessiva",
          name: "Risco de Humidade Excessiva",
          status: isSalsinhaHumStress ? "Atenção / Moderado" : "Baixo Risco",
          level: isSalsinhaHumStress ? "warning" : "success",
          badge: isSalsinhaHumStress ? "Risco de Podridão e Míldio" : "Umidade Confortável",
          value: `${currentHumidity}% UR + ${rain48h}mm em 48h`,
          description: "Alta umidade (acima de 75%) e acúmulo de água favorecem fungos de solo (Pythium/Rhizoctonia) e manchas foliares (Septoria).",
          icon: "bi-droplet-fill"
        },
        {
          id: "risco-temperatura-elevada",
          name: "Risco de Temperatura Elevada",
          status: currentTemp > 28 ? "Alerta Térmico" : "Baixo Risco",
          level: currentTemp > 28 ? "warning" : "success",
          badge: currentTemp > 28 ? "Risco de Desaceleração" : "Clima Ameno Adequado",
          value: `${currentTemp}°C (${currentTemp > 28 ? 'T > 28°C' : 'Faixa Segura'})`,
          description: "A temperatura atual está dentro da faixa confortável (10°C a 24°C). Risco de retardo vegetativo caso supere 28°C.",
          icon: "bi-thermometer"
        }
      ],
      recommendations: [
        "Garantir drenagem eficiente dos canteiros para prevenir encharcamento e podridões radiculares.",
        "Realizar desbaste foliar preventivo e manter aeração constante para diminuir a umidade estagnada.",
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
    source,
    generalWeather,
    plants
  };
}

module.exports = {
  getDashboardData
};
