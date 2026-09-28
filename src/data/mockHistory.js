/**
 * Dados Históricos Meteorológicos (Estrutura compatível com INMET - Instituto Nacional de Meteorologia)
 * Período: 2004 a 08/2026
 * Estação Meteorológica: A707 - Presidente Prudente / Região Álvares Machado - SP
 */

// Gera estatísticas mensais e anuais consistentes para o período de 2004 a 08/2026
function generateHistoricalData() {
  const stationInfo = {
    station_code: "A707",
    station_name: "Presidente Prudente / Álvares Machado",
    state: "SP",
    latitude: -22.1198,
    longitude: -51.4085,
    altitude: 435.5,
    period_start: "2004-01-01",
    period_end: "2026-08-31",
    source: "INMET (Instituto Nacional de Meteorologia) - Dados Históricos de Estação Automática"
  };

  const monthlyRecords = [];
  const yearsSummary = [];

  // Padrão sazonal típico do interior paulista (Presidente Prudente / Álvares Machado)
  // [mês 1..12]: { tempBase, tempMaxDelta, rainBase, humidityBase, windBase }
  const seasonalProfile = [
    { month: 1, name: "Janeiro", tempMedia: 26.2, tempMax: 31.8, tempMin: 21.5, rain: 220, humidity: 76, windKmH: 14.5 },
    { month: 2, name: "Fevereiro", tempMedia: 26.0, tempMax: 31.6, tempMin: 21.4, rain: 185, humidity: 77, windKmH: 13.8 },
    { month: 3, name: "Março", tempMedia: 25.5, tempMax: 31.2, tempMin: 20.6, rain: 140, humidity: 74, windKmH: 12.9 },
    { month: 4, name: "Abril", tempMedia: 23.4, tempMax: 29.5, tempMin: 18.2, rain: 85, humidity: 71, windKmH: 12.2 },
    { month: 5, name: "Maio", tempMedia: 20.2, tempMax: 26.4, tempMin: 15.1, rain: 60, humidity: 72, windKmH: 11.5 },
    { month: 6, name: "Junho", tempMedia: 19.1, tempMax: 25.5, tempMin: 13.8, rain: 45, humidity: 70, windKmH: 11.8 },
    { month: 7, name: "Julho", tempMedia: 19.3, tempMax: 26.1, tempMin: 13.5, rain: 35, humidity: 64, windKmH: 13.1 },
    { month: 8, name: "Agosto", tempMedia: 21.5, tempMax: 28.8, tempMin: 15.2, rain: 30, humidity: 55, windKmH: 15.2 },
    { month: 9, name: "Setembro", tempMedia: 23.6, tempMax: 30.2, tempMin: 17.8, rain: 75, humidity: 58, windKmH: 16.8 },
    { month: 10, name: "Outubro", tempMedia: 25.2, tempMax: 31.3, tempMin: 19.8, rain: 130, humidity: 66, windKmH: 16.2 },
    { month: 11, name: "Novembro", tempMedia: 25.8, tempMax: 31.7, tempMin: 20.6, rain: 160, humidity: 69, windKmH: 15.0 },
    { month: 12, name: "Dezembro", tempMedia: 26.1, tempMax: 31.6, tempMin: 21.2, rain: 210, humidity: 74, windKmH: 14.2 }
  ];

  for (let year = 2004; year <= 2026; year++) {
    const endMonth = (year === 2026) ? 8 : 12;
    let yearTotalRain = 0;
    let yearTempSum = 0;
    let yearMaxTemp = -99;
    let yearMinTemp = 99;
    let yearHailEvents = 0;
    let yearHeatwaveEvents = 0;
    let yearHeavyRainEvents = 0;
    let yearWindstormEvents = 0;

    // Fator de variação climática anual (ciclos El Niño / La Niña)
    const cycleFactor = Math.sin((year - 2004) * 0.7);
    const rainAnomaly = cycleFactor * 35;
    const tempAnomaly = (year - 2004) * 0.04 + cycleFactor * 0.4; // leve tendência de aquecimento

    for (let m = 1; m <= endMonth; m++) {
      const season = seasonalProfile[m - 1];
      const monthSeed = ((year * 13) + m * 7) % 17 - 8;

      const tempMedia = Number((season.tempMedia + tempAnomaly + (monthSeed * 0.08)).toFixed(1));
      const tempMax = Number((season.tempMax + tempAnomaly + Math.abs(monthSeed * 0.12)).toFixed(1));
      const tempMin = Number((season.tempMin + tempAnomaly - Math.abs(monthSeed * 0.1)).toFixed(1));
      const tempMaxAbsoluta = Number((tempMax + 3.2 + Math.abs(monthSeed * 0.2)).toFixed(1));
      const tempMinAbsoluta = Number((tempMin - 4.1 - Math.abs(monthSeed * 0.15)).toFixed(1));

      const precipitation = Math.max(0, Math.round(season.rain + rainAnomaly + (monthSeed * 6.5)));
      const humidity = Math.min(95, Math.max(35, Math.round(season.humidity - (tempAnomaly * 0.5) + (monthSeed * 0.8))));
      const windSpeedKmH = Number((season.windKmH + (Math.abs(monthSeed) * 0.4)).toFixed(1));
      const windGustMax = Number((windSpeedKmH * 2.8 + (monthSeed > 2 ? 15 : 5)).toFixed(1));

      // Eventos de risco meteorológico
      const hailOccurred = (m >= 9 && m <= 11 && (year % 3 === 0 || monthSeed > 5)) ? 1 : 0;
      const heatwaveDays = tempMaxAbsoluta >= 36.5 ? (tempMaxAbsoluta >= 38 ? 6 : 3) : 0;
      const heavyRainDays = precipitation >= 160 ? Math.floor(precipitation / 50) : (precipitation > 100 ? 1 : 0);
      const windstormEvents = windGustMax >= 65 ? 1 : 0;

      // Análise de risco para culturas do Viveiro Bioterra
      const risksByCrop = {
        alface_solaris: {
          stress_termico: tempMax >= 31 ? "ALTO" : (tempMax >= 28 ? "MEDIO" : "BAIXO"),
          dias_nublados_estimados: humidity > 72 ? Math.round(precipitation / 15) : 3,
          tempo_sem_chuva_dias: precipitation < 40 ? 22 : (precipitation < 80 ? 14 : 6)
        },
        salsinha: {
          excesso_umidade: humidity > 75 || precipitation > 180 ? "ALTO" : (humidity > 68 ? "MEDIO" : "BAIXO"),
          risco_temperatura_elevada: tempMax >= 32 ? "ALTO" : (tempMax >= 29 ? "MEDIO" : "BAIXO"),
          precipitacao_acumulada_mm: precipitation
        },
        flor_do_deserto: {
          excesso_umidade: humidity > 72 || precipitation > 120 ? "CRITICO" : (precipitation > 60 ? "MEDIO" : "BAIXO"),
          tempo_sem_chuva_adequado: precipitation < 60 ? "IDEAL" : "ATENCAO"
        }
      };

      const monthRecord = {
        id: `${year}-${String(m).padStart(2, "0")}`,
        year,
        month: m,
        month_name: season.name,
        period: `${String(m).padStart(2, "0")}/${year}`,
        temperature: {
          average_c: tempMedia,
          max_average_c: tempMax,
          min_average_c: tempMin,
          max_absolute_c: tempMaxAbsoluta,
          min_absolute_c: tempMinAbsoluta
        },
        precipitation: {
          total_mm: precipitation,
          rainy_days: precipitation > 0 ? Math.min(22, Math.max(1, Math.round(precipitation / 14))) : 0,
          dry_days: 30 - (precipitation > 0 ? Math.min(22, Math.max(1, Math.round(precipitation / 14))) : 0)
        },
        humidity: {
          average_percent: humidity
        },
        wind: {
          average_kmh: windSpeedKmH,
          max_gust_kmh: windGustMax
        },
        climate_risks: {
          hail_events: hailOccurred,
          heatwave_days: heatwaveDays,
          heavy_rain_days: heavyRainDays,
          windstorm_events: windstormEvents
        },
        crop_impacts: risksByCrop
      };

      monthlyRecords.push(monthRecord);

      yearTotalRain += precipitation;
      yearTempSum += tempMedia;
      yearMaxTemp = Math.max(yearMaxTemp, tempMaxAbsoluta);
      yearMinTemp = Math.min(yearMinTemp, tempMinAbsoluta);
      yearHailEvents += hailOccurred;
      yearHeatwaveEvents += heatwaveDays;
      yearHeavyRainEvents += heavyRainDays;
      yearWindstormEvents += windstormEvents;
    }

    yearsSummary.push({
      year,
      months_recorded: endMonth,
      total_precipitation_mm: yearTotalRain,
      average_temperature_c: Number((yearTempSum / endMonth).toFixed(1)),
      max_temperature_c: yearMaxTemp,
      min_temperature_c: yearMinTemp,
      total_risks: {
        hail_events: yearHailEvents,
        heatwave_days: yearHeatwaveEvents,
        heavy_rain_days: yearHeavyRainEvents,
        windstorm_events: yearWindstormEvents
      }
    });
  }

  return {
    station: stationInfo,
    summary_by_year: yearsSummary,
    monthly_data: monthlyRecords
  };
}

const mockHistoryData = generateHistoricalData();

module.exports = mockHistoryData;
