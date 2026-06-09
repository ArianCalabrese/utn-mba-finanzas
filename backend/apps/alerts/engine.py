"""
Alert evaluation engine.

A condition is a dict:
    {"path": "rsi_14", "operator": "<", "value": 40.0}

Supported paths (resolved against get_indicators result):
    rsi_14, z_score_200, drawdown_from_ath, current_price, obv,
    atr_14, macd.histogram, macd.macd, bollinger_bands.bandwidth_pct,
    stochastic.k, stochastic.d, adx_14.adx, adx_14.plus_di, adx_14.minus_di,
    moving_averages.sma_20, moving_averages.sma_50, moving_averages.sma_200

Conviction paths (resolved against get_conviction result):
    conviction.score
"""

import operator as op
from typing import Any

OPS = {
    '<': op.lt,
    '>': op.gt,
    '<=': op.le,
    '>=': op.ge,
    '==': op.eq,
}


def _resolve(data: dict, path: str) -> float | None:
    val: Any = data
    for key in path.split('.'):
        if isinstance(val, dict) and key in val:
            val = val[key]
        else:
            return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def evaluate_condition(condition: dict, indicators: dict, conviction: dict | None = None) -> bool | None:
    """Returns True/False if condition is evaluable, None if data is missing."""
    path: str = condition.get('path', '')
    operator_str: str = condition.get('operator', '')
    threshold = condition.get('value')

    if operator_str not in OPS or threshold is None:
        return None

    source = conviction if path.startswith('conviction.') else indicators
    if source is None:
        return None

    current = _resolve(source, path)
    if current is None:
        return None

    return OPS[operator_str](current, float(threshold))


def evaluate_alert(alert, indicators: dict, conviction: dict | None = None) -> dict:
    """
    Returns:
        {
            'triggered': bool,
            'results': [{'condition': {...}, 'result': bool|None}],
            'missing_data': bool,
        }
    """
    results = []
    for cond in alert.conditions:
        result = evaluate_condition(cond, indicators, conviction)
        results.append({'condition': cond, 'result': result})

    valid = [r for r in results if r['result'] is not None]
    missing_data = len(valid) < len(results)

    if not valid:
        return {'triggered': False, 'results': results, 'missing_data': True}

    if alert.operator == 'AND':
        triggered = all(r['result'] for r in valid)
    else:
        triggered = any(r['result'] for r in valid)

    return {'triggered': triggered, 'results': results, 'missing_data': missing_data}
