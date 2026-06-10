"""Universos predefinidos de tickers para el Radar de Oportunidades.

Listas curadas y acotadas (el escaneo calcula convicción completa por ticker,
así que el tamaño se mantiene razonable para tiempos de respuesta).
"""

UNIVERSES: dict[str, dict] = {
    'megacaps_us': {
        'label': 'Mega Caps EE.UU.',
        'description': 'Las 30 empresas de mayor capitalización del mercado estadounidense.',
        'tickers': [
            'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'AVGO',
            'BRK-B', 'LLY', 'JPM', 'V', 'XOM', 'UNH', 'MA', 'PG', 'COST',
            'HD', 'MRK', 'ABBV', 'CVX', 'KO', 'PEP', 'WMT', 'BAC', 'ADBE',
            'CRM', 'NFLX', 'AMD', 'ORCL',
        ],
    },
    'etfs_globales': {
        'label': 'ETFs Globales',
        'description': 'Índices amplios, renta fija, oro y sectores principales.',
        'tickers': [
            'SPY', 'VOO', 'QQQ', 'VTI', 'IWM', 'DIA', 'EFA', 'EEM', 'VEA',
            'VWO', 'AGG', 'TLT', 'LQD', 'HYG', 'GLD', 'SLV', 'XLE', 'XLK',
            'XLF', 'XLV',
        ],
    },
    'dividendos': {
        'label': 'Dividendos Consistentes',
        'description': 'Empresas con décadas de dividendos crecientes (aristócratas).',
        'tickers': [
            'JNJ', 'PG', 'KO', 'PEP', 'MMM', 'CAT', 'MCD', 'CL', 'KMB',
            'ADP', 'AFL', 'GD', 'ITW', 'LOW', 'MDT', 'SYY', 'TGT', 'TROW',
            'O', 'VZ',
        ],
    },
    'growth_tech': {
        'label': 'Tecnología / Growth',
        'description': 'Semiconductores, software y plataformas de crecimiento.',
        'tickers': [
            'NVDA', 'AMD', 'AVGO', 'QCOM', 'TXN', 'MU', 'INTC', 'CRM', 'NOW',
            'ADBE', 'ORCL', 'PLTR', 'SNOW', 'DDOG', 'NET', 'CRWD', 'ZS',
            'PANW', 'UBER', 'ABNB',
        ],
    },
    'adrs_argentina': {
        'label': 'ADRs Argentina',
        'description': 'Empresas argentinas que cotizan en Nueva York.',
        'tickers': [
            'GGAL', 'YPF', 'PAM', 'BMA', 'SUPV', 'CEPU', 'EDN', 'LOMA',
            'TGS', 'CRESY', 'IRS', 'TEO', 'MELI', 'GLOB', 'DESP', 'VIST',
        ],
    },
}
