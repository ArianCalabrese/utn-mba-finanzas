#!/bin/bash
# =============================================================================
# cleanup.sh — Elimina COMPLETAMENTE el despliegue de fincalc
# =============================================================================
set -e

SERVICE_NAME="fincalc"
APP_DIR="/var/www/fincalc"
DOMAIN="fincalc.abastolink.cloud"
NGINX_CONF_DIR="/var/www/abastolink/nginx/conf.d"
NGINX_CONTAINER="abastolink_nginx"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC} $1"; }
warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }

[[ $EUID -ne 0 ]] && echo "Ejecutar como root." && exit 1

echo ""
echo -e "${RED}========================================================${NC}"
echo -e "${RED}  Esto elimina el despliegue completo de $DOMAIN${NC}"
echo -e "${RED}========================================================${NC}"
echo ""
read -p "Escribe 'eliminar' para confirmar: " CONFIRM
[[ "$CONFIRM" != "eliminar" ]] && echo "Cancelado." && exit 0

# Bajar contenedores Docker
info "Bajando contenedores Docker..."
if [[ -f "$APP_DIR/deploy/docker-compose.yml" ]]; then
    docker compose -f "$APP_DIR/deploy/docker-compose.yml" down --rmi all --volumes 2>/dev/null \
        && info "Contenedores e imágenes eliminados." \
        || warning "Error al bajar contenedores (puede que no estuvieran corriendo)."
else
    # Fallback por si no existe el compose
    docker rm -f fincalc_api fincalc_frontend 2>/dev/null || true
fi

# Eliminar servicio systemd (si quedó del primer intento)
if systemctl list-unit-files "$SERVICE_NAME.service" &>/dev/null 2>&1; then
    info "Eliminando servicio systemd..."
    systemctl stop "$SERVICE_NAME" 2>/dev/null || true
    systemctl disable "$SERVICE_NAME" 2>/dev/null || true
    rm -f "/etc/systemd/system/$SERVICE_NAME.service"
    systemctl daemon-reload
fi

# Eliminar config nginx
info "Eliminando config nginx..."
rm -f "$NGINX_CONF_DIR/fincalc.conf"
if docker inspect "$NGINX_CONTAINER" &>/dev/null; then
    docker exec "$NGINX_CONTAINER" nginx -t && docker exec "$NGINX_CONTAINER" nginx -s reload
    info "nginx recargado."
fi

# Eliminar certificado SSL
info "Eliminando certificado SSL..."
docker run --rm \
    -v abastolink_certbot_conf:/etc/letsencrypt \
    certbot/certbot delete \
    --cert-name "$DOMAIN" \
    --non-interactive 2>/dev/null \
    && info "Certificado eliminado." \
    || warning "No se encontró certificado (puede que ya estuviera eliminado)."

# Eliminar logs y directorio
info "Eliminando logs..."
rm -f "/var/log/$SERVICE_NAME-access.log" "/var/log/$SERVICE_NAME-error.log"

info "Eliminando directorio $APP_DIR..."
rm -rf "$APP_DIR"

echo ""
echo -e "${GREEN}========================================================${NC}"
echo -e "${GREEN}  Limpieza completada.${NC}"
echo -e "${GREEN}========================================================${NC}"
echo ""
echo "Recuerda eliminar el registro DNS 'fincalc' en Hostinger."
echo ""
