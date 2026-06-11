"""Catálogo declarativo de filtros del screener fundamental.

Única fuente de verdad: el frontend consume `/api/screener/fields/` para
construir el formulario dinámicamente y el backend traduce cada filtro a un
`yfinance.EquityQuery` usando el campo `yahoo` de cada entrada.

Sobre las unidades (verificado empíricamente contra el screener de Yahoo):
- Ratios (P/E, P/B, beta, current ratio…): valor crudo, sin escala.
- Porcentajes (ROE, márgenes, growth, dividend yield, deuda/equity, %52sem):
  Yahoo los almacena ya como porcentaje (15 = 15%), así que el usuario ingresa
  el número directo y NO se escala.
- Capitalización de mercado: Yahoo la guarda en USD crudo. El usuario la ingresa
  en MILLONES de USD, por eso `scale = 1e6`.
"""

# Sectores GICS válidos en el screener de Yahoo (valores exactos esperados).
SECTORS = [
    'Basic Materials', 'Communication Services', 'Consumer Cyclical',
    'Consumer Defensive', 'Energy', 'Financial Services', 'Healthcare',
    'Industrials', 'Real Estate', 'Technology', 'Utilities',
]

# Subconjunto curado de regiones (código Yahoo → etiqueta) para mantener el
# selector limpio. Yahoo acepta ~59 códigos; estos cubren los mercados de interés.
REGIONS = [
    ('us', 'Estados Unidos'),
    ('ar', 'Argentina'),
    ('br', 'Brasil'),
    ('mx', 'México'),
    ('cl', 'Chile'),
    ('ca', 'Canadá'),
    ('gb', 'Reino Unido'),
    ('de', 'Alemania'),
    ('fr', 'Francia'),
    ('es', 'España'),
    ('it', 'Italia'),
    ('nl', 'Países Bajos'),
    ('ch', 'Suiza'),
    ('jp', 'Japón'),
    ('cn', 'China'),
    ('hk', 'Hong Kong'),
    ('in', 'India'),
    ('kr', 'Corea del Sur'),
    ('au', 'Australia'),
]

# Cada entrada:
#   key      identificador corto usado en el request del frontend
#   label    etiqueta visible
#   category grupo del acordeón
#   yahoo    campo real de EquityQuery
#   type     'range' | 'min' | 'max' | 'select'
#   unit     'ratio' | 'percent' | 'currency' | 'plain'  (solo display)
#   scale    multiplicador aplicado al valor antes de mandarlo a Yahoo
#   options  (solo 'select') lista de {value, label}
FIELDS: list[dict] = [
    # ── Generales ──
    {'key': 'region', 'label': 'País / Región', 'category': 'Generales',
     'yahoo': 'region', 'type': 'select', 'unit': 'plain', 'scale': 1,
     'options': [{'value': v, 'label': l} for v, l in REGIONS]},
    {'key': 'sector', 'label': 'Sector', 'category': 'Generales',
     'yahoo': 'sector', 'type': 'select', 'unit': 'plain', 'scale': 1,
     'options': [{'value': s, 'label': s} for s in SECTORS]},
    {'key': 'marketcap', 'label': 'Cap. de mercado', 'category': 'Generales',
     'yahoo': 'intradaymarketcap', 'type': 'range', 'unit': 'currency', 'scale': 1e6},

    # ── Valuación ──
    {'key': 'pe', 'label': 'P/E (trailing)', 'category': 'Valuación',
     'yahoo': 'peratio.lasttwelvemonths', 'type': 'range', 'unit': 'ratio', 'scale': 1},
    {'key': 'pb', 'label': 'P/B', 'category': 'Valuación',
     'yahoo': 'pricebookratio.quarterly', 'type': 'range', 'unit': 'ratio', 'scale': 1},
    {'key': 'ps', 'label': 'P/S', 'category': 'Valuación',
     'yahoo': 'lastclosemarketcaptotalrevenue.lasttwelvemonths', 'type': 'range', 'unit': 'ratio', 'scale': 1},
    {'key': 'peg', 'label': 'PEG (5a)', 'category': 'Valuación',
     'yahoo': 'pegratio_5y', 'type': 'range', 'unit': 'ratio', 'scale': 1},
    {'key': 'ev_ebitda', 'label': 'EV / EBITDA', 'category': 'Valuación',
     'yahoo': 'lastclosetevebitda.lasttwelvemonths', 'type': 'range', 'unit': 'ratio', 'scale': 1},

    # ── Rentabilidad ──
    {'key': 'roe', 'label': 'ROE', 'category': 'Rentabilidad',
     'yahoo': 'returnonequity.lasttwelvemonths', 'type': 'min', 'unit': 'percent', 'scale': 1},
    {'key': 'roa', 'label': 'ROA', 'category': 'Rentabilidad',
     'yahoo': 'returnonassets.lasttwelvemonths', 'type': 'min', 'unit': 'percent', 'scale': 1},
    {'key': 'roic', 'label': 'ROIC (ret. capital total)', 'category': 'Rentabilidad',
     'yahoo': 'returnontotalcapital.lasttwelvemonths', 'type': 'min', 'unit': 'percent', 'scale': 1},
    {'key': 'dividend_yield', 'label': 'Dividend Yield', 'category': 'Rentabilidad',
     'yahoo': 'forward_dividend_yield', 'type': 'range', 'unit': 'percent', 'scale': 1},

    # ── Salud financiera ──
    {'key': 'debt_equity', 'label': 'Deuda / Patrimonio', 'category': 'Salud financiera',
     'yahoo': 'totaldebtequity.lasttwelvemonths', 'type': 'max', 'unit': 'percent', 'scale': 1},
    {'key': 'current_ratio', 'label': 'Current Ratio', 'category': 'Salud financiera',
     'yahoo': 'currentratio.lasttwelvemonths', 'type': 'min', 'unit': 'ratio', 'scale': 1},
    {'key': 'quick_ratio', 'label': 'Quick Ratio', 'category': 'Salud financiera',
     'yahoo': 'quickratio.lasttwelvemonths', 'type': 'min', 'unit': 'ratio', 'scale': 1},

    # ── Márgenes ──
    {'key': 'gross_margin', 'label': 'Margen Bruto', 'category': 'Márgenes',
     'yahoo': 'grossprofitmargin.lasttwelvemonths', 'type': 'min', 'unit': 'percent', 'scale': 1},
    {'key': 'ebitda_margin', 'label': 'Margen EBITDA', 'category': 'Márgenes',
     'yahoo': 'ebitdamargin.lasttwelvemonths', 'type': 'min', 'unit': 'percent', 'scale': 1},
    {'key': 'net_margin', 'label': 'Margen Neto', 'category': 'Márgenes',
     'yahoo': 'netincomemargin.lasttwelvemonths', 'type': 'min', 'unit': 'percent', 'scale': 1},

    # ── Crecimiento ──
    {'key': 'revenue_growth', 'label': 'Crec. Ingresos (1a)', 'category': 'Crecimiento',
     'yahoo': 'totalrevenues1yrgrowth.lasttwelvemonths', 'type': 'min', 'unit': 'percent', 'scale': 1},
    {'key': 'eps_growth', 'label': 'Crec. EPS (1a)', 'category': 'Crecimiento',
     'yahoo': 'epsgrowth.lasttwelvemonths', 'type': 'min', 'unit': 'percent', 'scale': 1},

    # ── Técnico ──
    {'key': 'beta', 'label': 'Beta', 'category': 'Técnico',
     'yahoo': 'beta', 'type': 'range', 'unit': 'ratio', 'scale': 1},
    {'key': 'change_52w', 'label': 'Variación 52 sem.', 'category': 'Técnico',
     'yahoo': 'fiftytwowkpercentchange', 'type': 'range', 'unit': 'percent', 'scale': 1},
]

# Orden de las categorías en el acordeón del frontend.
CATEGORY_ORDER = [
    'Generales', 'Valuación', 'Rentabilidad', 'Salud financiera',
    'Márgenes', 'Crecimiento', 'Técnico',
]

# Índices auxiliares.
FIELDS_BY_KEY: dict[str, dict] = {f['key']: f for f in FIELDS}

# Campos por los que se puede ordenar la tabla (key → campo Yahoo).
SORTABLE = {
    'marketcap': 'intradaymarketcap',
    'pe': 'peratio.lasttwelvemonths',
    'pb': 'pricebookratio.quarterly',
    'dividend_yield': 'forward_dividend_yield',
    'change_52w': 'fiftytwowkpercentchange',
    'price': 'intradayprice',
}
