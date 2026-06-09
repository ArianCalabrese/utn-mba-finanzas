from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .services import calculate_price, calculate_ytm, calculate_duration, VALID_FREQUENCIES

_FREQ_ERROR = f'frequency must be one of {VALID_FREQUENCIES} (payments per year).'


def _parse_bond_fields(data: dict, require_ytm: bool = True) -> tuple | Response:
    try:
        face = float(data['face'])
        coupon_rate = float(data['coupon_rate'])
        periods = int(data['periods'])
        frequency = int(data.get('frequency', 2))
        ytm = float(data['ytm']) if require_ytm else None
    except (KeyError, ValueError, TypeError) as e:
        return Response({'error': f'Invalid or missing field: {e}'}, status=status.HTTP_400_BAD_REQUEST)

    if frequency not in VALID_FREQUENCIES:
        return Response({'error': _FREQ_ERROR}, status=status.HTTP_400_BAD_REQUEST)

    return (face, coupon_rate, periods, frequency, ytm)


class BondPriceView(APIView):
    def post(self, request):
        parsed = _parse_bond_fields(request.data)
        if isinstance(parsed, Response):
            return parsed
        face, coupon_rate, periods, frequency, ytm = parsed
        try:
            return Response(calculate_price(face, coupon_rate, periods, frequency, ytm))
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class BondYTMView(APIView):
    def post(self, request):
        try:
            market_price = float(request.data['market_price'])
            face = float(request.data['face'])
            coupon_rate = float(request.data['coupon_rate'])
            periods = int(request.data['periods'])
            frequency = int(request.data.get('frequency', 2))
        except (KeyError, ValueError, TypeError) as e:
            return Response({'error': f'Invalid or missing field: {e}'}, status=status.HTTP_400_BAD_REQUEST)

        if frequency not in VALID_FREQUENCIES:
            return Response({'error': _FREQ_ERROR}, status=status.HTTP_400_BAD_REQUEST)

        try:
            return Response(calculate_ytm(market_price, face, coupon_rate, periods, frequency))
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class BondDurationView(APIView):
    def post(self, request):
        parsed = _parse_bond_fields(request.data)
        if isinstance(parsed, Response):
            return parsed
        face, coupon_rate, periods, frequency, ytm = parsed
        try:
            return Response(calculate_duration(face, coupon_rate, periods, frequency, ytm))
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
