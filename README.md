# Viveiro Bioterra - Back-end API

API de serviços meteorológicos para o sistema de monitoramento climático e apoio à tomada de decisão no cultivo de **Alface Solaris**, **Salsinha** e **Rosa do Deserto** no Viveiro Bioterra (Álvares Machado / Presidente Prudente - SP).

---

## 🛠️ Tecnologias Utilizadas

- **Node.js** (v24+)
- **Express.js** (Framework HTTP minimalista e robusto)
- **Axios** (Cliente HTTP para integração com a HG Brasil Weather API)
- **CORS** (Permissão para requisições do Front-end React)

---

## 🚀 Como Executar

Dentro da pasta `backend`:

```bash
# Instalar dependências (caso necessário)
npm install

# Iniciar em modo de produção
npm start

# Iniciar em modo de desenvolvimento (com auto-reload)
npm run dev
```

Por padrão, o servidor rodará na porta `3001`:
`http://localhost:3001`

---

## 📡 Endpoints da API

### 1. `GET /api/weather/forecast`
Obtém a previsão do tempo atualizada e dos próximos dias utilizando a API HG Brasil.
Conta com sistema automático de fallback para dados mockados em caso de indisponibilidade ou esgotamento de cota da chave.

- **Parâmetros Opcionais (Query params):**
  - `woeid`: Código WOEID da localidade (Padrão: `458410` para Álvares Machado/Presidente Prudente).
  - `city_name`: Nome da cidade (opcional).
  - `key`: Chave da API HG Brasil (utiliza a chave de teste configurada por padrão).

- **Exemplo de Retorno:**
```json
{
  "success": true,
  "source": "hg_brasil_api",
  "data": {
    "by": "woeid",
    "valid_key": true,
    "results": {
      "temp": 24,
      "date": "28/09/2026",
      "city": "Álvares Machado, SP",
      "humidity": 78,
      "rain": 0,
      "wind_speedy": "4.12 km/h",
      "forecast": [
        { "date": "28/09", "weekday": "Seg", "max": 31, "min": 19, "rain": 0, "description": "Tempo limpo" }
      ]
    }
  }
}
```

---

### 2. `GET /api/weather/history`
Série histórica de medições meteorológicas com estrutura e variáveis compatíveis com a rede de estações automáticas do **INMET** (Estação A707 - Presidente Prudente / Álvares Machado).
Cobre o intervalo completo de **2004 até 08/2026**.

- **Parâmetros Opcionais (Query params):**
  - `year`: Filtra dados mensais de um ano específico (ex: `?year=2024` ou `?year=2026`).
  - `start_year` e `end_year`: Intervalo de anos (ex: `?start_year=2020&end_year=2025`).
  - `month`: Filtra por mês (1 a 12).
  - `crop`: Filtra e projeta métricas de impacto nas culturas (`alface_solaris`, `salsinha`, `Rosa_do_deserto`).
  - `summary`: Se `true`, retorna o consolidado anual (precipitação total, temperaturas extremas, contagem de granizo, ventanias e ondas de calor).
  - `limit`: Limita a quantidade de registros mensais retornados.

- **Exemplo de Retorno:**
```json
{
  "success": true,
  "source": "inmet_mock_history",
  "station": {
    "station_code": "A707",
    "station_name": "Presidente Prudente / Álvares Machado",
    "state": "SP",
    "period_start": "2004-01-01",
    "period_end": "2026-08-31"
  },
  "period_coverage": {
    "start": "2004-01-01",
    "end": "2026-08-31"
  },
  "total_records": 272,
  "data": [
    {
      "id": "2026-08",
      "year": 2026,
      "month": 8,
      "month_name": "Agosto",
      "temperature": { "average_c": 22.3, "max_average_c": 29.6, "min_average_c": 16.0 },
      "precipitation": { "total_mm": 28, "rainy_days": 2, "dry_days": 28 },
      "humidity": { "average_percent": 53 },
      "wind": { "average_kmh": 15.6, "max_gust_kmh": 48.7 },
      "climate_risks": { "hail_events": 0, "heatwave_days": 0, "heavy_rain_days": 0, "windstorm_events": 0 },
      "crop_impacts": {
        "alface_solaris": { "stress_termico": "MEDIO", "dias_nublados_estimados": 2, "tempo_sem_chuva_dias": 22 },
        "salsinha": { "excesso_umidade": "BAIXO", "risco_temperatura_elevada": "MEDIO" },
        "Rosa_do_deserto": { "excesso_umidade": "BAIXO", "tempo_sem_chuva_adequado": "IDEAL" }
      }
    }
  ]
}
```

---

### 3. `GET /api/health` e `GET /`
Verificação de saúde do serviço e catálogo de rotas.
