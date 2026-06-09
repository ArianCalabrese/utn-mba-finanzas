from rest_framework import serializers
from .models import Alert

VALID_PATHS = {
    'rsi_14', 'z_score_200', 'drawdown_from_ath', 'current_price', 'obv', 'atr_14',
    'macd.histogram', 'macd.macd', 'bollinger_bands.bandwidth_pct',
    'stochastic.k', 'stochastic.d',
    'adx_14.adx', 'adx_14.plus_di', 'adx_14.minus_di',
    'moving_averages.sma_20', 'moving_averages.sma_50', 'moving_averages.sma_200',
    'conviction.score',
}

VALID_OPERATORS = {'<', '>', '<=', '>=', '=='}


class AlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = Alert
        fields = [
            'id', 'ticker', 'name', 'conditions', 'operator',
            'is_active', 'last_checked', 'last_triggered', 'triggered_count', 'created_at',
        ]
        read_only_fields = ['id', 'last_checked', 'last_triggered', 'triggered_count', 'created_at']

    def validate_conditions(self, value):
        if not isinstance(value, list) or len(value) == 0:
            raise serializers.ValidationError('At least one condition is required.')
        if len(value) > 6:
            raise serializers.ValidationError('Maximum 6 conditions per alert.')
        for cond in value:
            if not isinstance(cond, dict):
                raise serializers.ValidationError('Each condition must be an object.')
            path = cond.get('path', '')
            operator = cond.get('operator', '')
            val = cond.get('value')
            if path not in VALID_PATHS:
                raise serializers.ValidationError(f"Invalid indicator path: '{path}'.")
            if operator not in VALID_OPERATORS:
                raise serializers.ValidationError(f"Invalid operator: '{operator}'.")
            if not isinstance(val, (int, float)):
                raise serializers.ValidationError('Condition value must be a number.')
        return value

    def validate_ticker(self, value):
        return value.upper().strip()
