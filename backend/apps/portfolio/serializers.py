from rest_framework import serializers
from .models import Portfolio, Transaction


class PortfolioSerializer(serializers.ModelSerializer):
    transaction_count = serializers.IntegerField(source='transactions.count', read_only=True)

    class Meta:
        model = Portfolio
        fields = ['id', 'name', 'category', 'base_currency', 'transaction_count', 'created_at']
        read_only_fields = ['id', 'transaction_count', 'created_at']

    def validate_base_currency(self, value):
        return value.upper().strip()[:3]

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('El nombre no puede estar vacío.')
        return value


class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = [
            'id', 'ticker', 'side', 'quantity', 'price', 'fees',
            'currency', 'trade_date', 'note', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def validate_ticker(self, value):
        return value.upper().strip()

    def validate_currency(self, value):
        return value.upper().strip()[:3]

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError('La cantidad debe ser mayor a 0.')
        return value

    def validate_price(self, value):
        if value < 0:
            raise serializers.ValidationError('El precio no puede ser negativo.')
        return value
