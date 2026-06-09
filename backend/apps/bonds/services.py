from scipy.optimize import brentq

VALID_FREQUENCIES = (1, 2, 4, 12)


def _price(ytm: float, face: float, coupon_rate: float, periods: int, frequency: int) -> float:
    c = face * coupon_rate / frequency
    y = ytm / frequency
    pv_coupons = sum(c / (1 + y) ** t for t in range(1, periods + 1))
    pv_face = face / (1 + y) ** periods
    return pv_coupons + pv_face


def calculate_price(face: float, coupon_rate: float, periods: int, frequency: int, ytm: float) -> dict:
    c = face * coupon_rate / frequency
    cash_flows = []
    for t in range(1, periods + 1):
        cf = c + (face if t == periods else 0)
        pv = cf / (1 + ytm / frequency) ** t
        cash_flows.append({'period': t, 'cash_flow': round(cf, 4), 'present_value': round(pv, 4)})

    return {
        'price': round(_price(ytm, face, coupon_rate, periods, frequency), 4),
        'face_value': face,
        'coupon_rate': coupon_rate,
        'coupon_payment': round(c, 4),
        'periods': periods,
        'frequency': frequency,
        'ytm': ytm,
        'cash_flows': cash_flows,
    }


def calculate_ytm(
    market_price: float,
    face: float,
    coupon_rate: float,
    periods: int,
    frequency: int,
) -> dict:
    try:
        ytm = brentq(
            lambda y: _price(y, face, coupon_rate, periods, frequency) - market_price,
            1e-6,
            10.0,
            maxiter=1000,
        )
    except ValueError:
        raise ValueError(
            'Could not solve for YTM. Verify that the market price is between '
            'the bond\'s deep-discount and deep-premium values.'
        )

    return {
        'ytm': round(ytm, 6),
        'ytm_pct': round(ytm * 100, 4),
        'market_price': market_price,
        'face_value': face,
        'coupon_rate': coupon_rate,
    }


def calculate_duration(
    face: float,
    coupon_rate: float,
    periods: int,
    frequency: int,
    ytm: float,
) -> dict:
    c = face * coupon_rate / frequency
    y = ytm / frequency
    price = _price(ytm, face, coupon_rate, periods, frequency)

    weighted_time = 0.0
    convexity_num = 0.0
    for t in range(1, periods + 1):
        cf = c + (face if t == periods else 0)
        pv = cf / (1 + y) ** t
        weighted_time += (t / frequency) * pv
        convexity_num += t * (t + 1) * cf / (1 + y) ** (t + 2)

    macaulay = weighted_time / price
    modified = macaulay / (1 + y)
    convexity = convexity_num / (price * frequency ** 2)
    dv01 = modified * price * 0.0001

    return {
        'price': round(price, 4),
        'macaulay_duration': round(macaulay, 4),
        'modified_duration': round(modified, 4),
        'convexity': round(convexity, 4),
        'dv01': round(dv01, 6),
    }
