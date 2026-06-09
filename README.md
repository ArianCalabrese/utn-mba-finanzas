# Finance Calculator

Herramienta web académica desarrollada para la Maestría en Administración de Negocios (UTN). Integra calculadoras financieras clásicas con análisis de mercado en tiempo real vía Yahoo Finance.

## Funcionalidades

### Calculadoras Financieras (offline)
| Módulo | Descripción |
|---|---|
| Interés Simple y Compuesto | Cálculo de capital, tasa y tiempo |
| Anualidades y Perpetuidades | Valor presente/futuro, cuotas |
| Gradientes | Gradiente aritmético y geométrico |
| Amortización | Tablas French y alemán |
| NPV / IRR | Evaluación de proyectos de inversión |
| Valor Tiempo del Dinero | Conversión entre VP, VF, tasa y períodos |

### Análisis de Mercado (requiere conexión)
| Módulo | Descripción |
|---|---|
| Cotizaciones | Precio en tiempo real, OHLCV, 52w high/low, market cap |
| Análisis Técnico | RSI, MACD, Bandas de Bollinger, ATR, Estocástico, SMA/EMA |
| Análisis Fundamental | P/E, P/B, ROE, ROA, márgenes, estados financieros, dividendos, DCF |
| Portfolio | Optimización Markowitz (max Sharpe / min varianza), frontera eficiente, VaR 95/99%, correlación y beta |
| Bonos (API) | Precio, YTM, duración Macaulay/modificada, convexidad, DV01 |

### Autenticación
- Registro e inicio de sesión con JWT
- Refresh tokens automático y blacklist en logout

---

## Stack Tecnológico

**Backend**
- Python 3.11+, Django 5, Django REST Framework
- `djangorestframework-simplejwt` — autenticación JWT
- `yfinance` — datos de mercado
- `pandas`, `numpy`, `scipy` — cálculos cuantitativos
- `cachetools` — caché en memoria (quotes: 5 min, historial: 15 min, fundamentales: 1 h)
- SQLite (base de datos)

**Frontend**
- React 19, TypeScript, Vite 8
- `zustand` — estado global
- `react-router-dom` v7 — navegación
- `recharts` — gráficos
- `react-hook-form` + `zod` — formularios y validación
- Arquitectura por capas: `domain / application / presentation`

---

## Setup Local

### Requisitos previos
- Python 3.11+
- Node.js 20+
- Git

---

### 1. Clonar el repositorio

```bash
git clone https://github.com/ArianCalabrese/utn-mba-finanzas.git
cd utn-mba-finanzas
```

---

### 2. Backend

```bash
cd backend
```

Crear y activar el entorno virtual:

```bash
# Linux / macOS
python3 -m venv venv
source venv/bin/activate

# Windows
python -m venv venv
venv\Scripts\activate
```

Instalar dependencias:

```bash
pip install -r requirements.txt
```

Crear el archivo de variables de entorno:

```bash
cp .env.example .env   # si existe, o crear manualmente
```

Contenido mínimo del `.env`:

```env
SECRET_KEY=cambia-esto-por-una-clave-segura
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Aplicar migraciones y levantar el servidor:

```bash
python manage.py migrate
python manage.py runserver
```

El backend queda disponible en `http://localhost:8000`.

---

### 3. Frontend

En otra terminal, desde la raíz del proyecto:

```bash
cd frontend
npm install
npm run dev
```

La app queda disponible en `http://localhost:5173`.

> Por defecto el frontend apunta a `http://localhost:8000/api`. Si el backend corre en otro puerto, crear `frontend/.env` con:
> ```env
> VITE_API_URL=http://localhost:<puerto>/api
> ```

---

### 4. (Opcional) Crear superusuario Django

```bash
cd backend
python manage.py createsuperuser
```

El panel de administración está en `http://localhost:8000/admin`.

---

## Estructura del Proyecto

```
.
├── backend/
│   ├── apps/
│   │   ├── bonds/          # Calculadora de bonos
│   │   ├── core/           # Utilidades compartidas (caché)
│   │   ├── fundamental/    # Ratios, estados financieros, DCF
│   │   ├── market/         # Cotizaciones e historial de precios
│   │   ├── portfolio/      # Optimización, VaR, backtesting
│   │   ├── technical/      # Indicadores técnicos
│   │   └── users/          # Autenticación JWT
│   ├── config/             # Settings, URLs, WSGI
│   ├── manage.py
│   └── requirements.txt
│
└── frontend/
    └── src/
        ├── domain/         # Modelos y lógica de calculadoras
        ├── application/    # API client, hooks, stores
        └── presentation/   # Páginas y componentes UI
```

---

## Endpoints principales de la API

| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/api/auth/register/` | Registro |
| `POST` | `/api/auth/login/` | Login (devuelve access + refresh) |
| `POST` | `/api/auth/refresh/` | Renovar access token |
| `POST` | `/api/auth/logout/` | Logout (blacklist del refresh token) |
| `GET` | `/api/market/quote/?ticker=AAPL` | Cotización en tiempo real |
| `GET` | `/api/market/history/?ticker=AAPL&period=1y` | Historial OHLCV |
| `GET` | `/api/market/compare/?tickers=AAPL,MSFT` | Comparación normalizada |
| `GET` | `/api/technical/?ticker=AAPL&period=6mo` | Indicadores técnicos |
| `GET` | `/api/fundamental/ratios/?ticker=AAPL` | Ratios fundamentales |
| `GET` | `/api/fundamental/statements/?ticker=AAPL` | Estados financieros |
| `GET` | `/api/fundamental/dcf/?ticker=AAPL` | Valoración DCF |
| `POST` | `/api/portfolio/optimize/` | Optimización Markowitz |
| `POST` | `/api/portfolio/var/` | Value at Risk |
| `POST` | `/api/bonds/price/` | Precio de bono |
| `POST` | `/api/bonds/ytm/` | Yield to Maturity |
| `POST` | `/api/bonds/duration/` | Duración y convexidad |
| `GET` | `/api/health/` | Health check (sin autenticación) |

Todos los endpoints (excepto `health`, `register` y `login`) requieren el header:
```
Authorization: Bearer <access_token>
```
