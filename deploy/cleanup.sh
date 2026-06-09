#!/bin/bash
# =============================================================================
# cleanup.sh — Elimina COMPLETAMENTE el despliegue de fincalc de la VPS
# Ejecutar como root: bash cleanup.sh
# =============================================================================
set -e

SERVICE_NAME="fincalc"
APP_DIR="/var/www/fincalc"
DOMAIN="fincalc.abastolink.cloud"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC} $1"; }
warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }

[[ $EUID -ne 0 ]] && echo "Ejecutar como root." && exit 1

echo ""
echo -e "${RED}========================================================${NC}"
echo -e "${RED}  ADVERTENCIA: Esto elimina el despliegue completo${NC}"
echo -e "${RED}  de $DOMAIN de esta VPS.${NC}"
echo -e "${RED}========================================================${NC}"
echo ""
read -p "¿Estás seguro? Escribe 'eliminar' para confirmar: " CONFIRM
[[ "$CONFIRM" != "eliminar" ]] && echo "Cancelado." && exit 0

# Detener y eliminar servicio systemd
info "Deteniendo servicio $SERVICE_NAME..."
systemctl stop "$SERVICE_NAME" 2>/dev/null && info "Servicio detenido." || warning "El servicio no estaba corriendo."
systemctl disable "$SERVICE_NAME" 2>/dev/null || true
rm -f "/etc/systemd/system/$SERVICE_NAME.service"
systemctl daemon-reload
info "Servicio systemd eliminado."

# Eliminar configuración NGINX
info "Eliminando configuración NGINX..."
rm -f "/etc/nginx/sites-enabled/$SERVICE_NAME"
rm -f "/etc/nginx/sites-available/$SERVICE_NAME"
nginx -t && systemctl reload nginx
info "NGINX recargado."

# Revocar y eliminar certificado SSL
info "Eliminando certificado SSL..."
certbot delete --cert-name "$DOMAIN" --non-interactive 2>/dev/null \
    && info "Certificado eliminado." \
    || warning "No se encontró certificado para $DOMAIN (puede que ya estuviera eliminado)."

# Eliminar logs
info "Eliminando logs..."
rm -f "/var/log/$SERVICE_NAME-access.log"
rm -f "/var/log/$SERVICE_NAME-error.log"

# Eliminar directorio de la app
info "Eliminando directorio $APP_DIR..."
rm -rf "$APP_DIR"
info "Directorio eliminado."

echo ""
echo -e "${GREEN}========================================================${NC}"
echo -e "${GREEN}  Limpieza completada. No queda nada de fincalc.${NC}"
echo -e "${GREEN}========================================================${NC}"
echo ""
echo "Recuerda eliminar también el registro DNS 'fincalc' en el panel de Hostinger."
echo ""
