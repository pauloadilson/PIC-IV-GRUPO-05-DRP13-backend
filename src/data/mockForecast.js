/**
 * Dados mockados de previsão do tempo (formato HG Brasil Weather API)
 * Utilizados como fallback caso a API externa atinja limite de requisições ou fique offline.
 */
const mockForecast = {
  by: "default",
  valid_key: true,
  results: {
    temp: 24,
    date: "28/09/2026",
    time: "08:00",
    condition_code: "28",
    description: "Tempo limpo com sol entre nuvens",
    currently: "dia",
    cid: "",
    city: "Álvares Machado, SP",
    img_id: "28",
    humidity: 65,
    cloudiness: 25,
    rain: 0,
    wind_speedy: "8.5 km/h",
    wind_direction: 120,
    wind_cardinal: "SE",
    sunrise: "06:05 am",
    sunset: "06:18 pm",
    moon_phase: "cheia",
    forecast: [
      {
        date: "28/09",
        weekday: "Seg",
        max: 31,
        min: 19,
        cloudiness: 20,
        rain: 0,
        rain_probability: 10,
        wind_speedy: "11 km/h",
        description: "Ensolarado com poucas nuvens",
        condition: "clear_day"
      },
      {
        date: "29/09",
        weekday: "Ter",
        max: 33,
        min: 20,
        cloudiness: 35,
        rain: 2,
        rain_probability: 30,
        wind_speedy: "14 km/h",
        description: "Sol e aumento de nuvens à tarde",
        condition: "cloudly_day"
      },
      {
        date: "30/09",
        weekday: "Qua",
        max: 29,
        min: 21,
        cloudiness: 70,
        rain: 18,
        rain_probability: 75,
        wind_speedy: "22 km/h",
        description: "Pancadas de chuva e trovoadas",
        condition: "rain"
      },
      {
        date: "01/10",
        weekday: "Qui",
        max: 27,
        min: 18,
        cloudiness: 50,
        rain: 5,
        rain_probability: 45,
        wind_speedy: "15 km/h",
        description: "Chuva passageira",
        condition: "rain"
      },
      {
        date: "02/10",
        weekday: "Sex",
        max: 30,
        min: 17,
        cloudiness: 15,
        rain: 0,
        rain_probability: 5,
        wind_speedy: "9 km/h",
        description: "Tempo aberto e ensolarado",
        condition: "clear_day"
      },
      {
        date: "03/10",
        weekday: "Sáb",
        max: 32,
        min: 19,
        cloudiness: 25,
        rain: 0,
        rain_probability: 10,
        wind_speedy: "10 km/h",
        description: "Predomínio de sol",
        condition: "clear_day"
      },
      {
        date: "04/10",
        weekday: "Dom",
        max: 34,
        min: 22,
        cloudiness: 40,
        rain: 8,
        rain_probability: 60,
        wind_speedy: "18 km/h",
        description: "Calor com pancadas isoladas",
        condition: "rain"
      }
    ]
  }
};

module.exports = mockForecast;
