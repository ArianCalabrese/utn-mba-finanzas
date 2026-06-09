#!/bin/bash
# =============================================================================
# deploy.sh — Despliega fincalc.abastolink.cloud en la VPS
# Ejecutar como root desde /var/www/fincalc: bash deploy/deploy.sh
# Requiere que abastolink_nginx esté corriendo con conf.d en
# /var/www/abastolink/nginx/conf.d/
# =============================================================================
set -e

DOMAIN="fincalc.abastolink.cloud"
REPO="https://github.com/ArianCalabrese/utn-mba-finanzas"
APP_DIR="/var/www/fincalc"
SERVICE_NAME="fincalc"
NGINX_CONF_DIR="/var/www/abastolink/nginx/conf.d"
NGINX_CONTAINER="abastolink_nginx"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC} $1"; }
warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

[[ $EUID -ne 0 ]] && error "Ejecutar como root."

# ---------- Verificar DNS ---------------------------------------------------
SERVER_IP=$(curl -s ifconfig.me)
DNS_IP=$(dig +short "$DOMAIN" | tail -1)
if [[ "$DNS_IP" != "$SERVER_IP" ]]; then
    warning "DNS de $DOMAIN apunta a $DNS_IP, esta VPS es $SERVER_IP."
    warning "Certbot fallará si el DNS no propagó."
    read -p "¿Continuar de todas formas? (s/N): " RESP
    [[ "$RESP" != "s" && "$RESP" != "S" ]] && exit 1
fi

# ---------- Verificar dependencias ------------------------------------------
command -v docker &>/dev/null || error "Docker no está instalado."
docker compose version &>/dev/null || error "Docker Compose no está disponible."
docker inspect "$NGINX_CONTAINER" &>/dev/null || error "El contenedor $NGINX_CONTAINER no está corriendo."

# ---------- Clonar / actualizar repositorio ---------------------------------
info "Actualizando repositorio..."
if [[ -d "$APP_DIR/.git" ]]; then
    git -C "$APP_DIR" pull
else
    git clone "$REPO" "$APP_DIR"
fi

# ---------- Limpiar servicio systemd anterior (si existía) ------------------
if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    info "Deteniendo servicio systemd previo..."
    systemctl stop "$SERVICE_NAME"
    systemctl disable "$SERVICE_NAME"
    rm -f "/etc/systemd/system/$SERVICE_NAME.service"
    systemctl daemon-reload
fi

# ---------- Archivo .env del backend ----------------------------------------
ENV_FILE="$APP_DIR/backend/.env"
if [[ ! -f "$ENV_FILE" ]]; then
    info "Creando .env..."
    SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(50))")
    cat > "$ENV_FILE" <<EOF
SECRET_KEY=$SECRET_KEY
DEBUG=False
ALLOWED_HOSTS=$DOMAIN,www.$DOMAIN,localhost
CORS_ALLOWED_ORIGINS=https://$DOMAIN,https://www.$DOMAIN
EOF
else
    info ".env ya existe — no se sobreescribe."
fi

# Asegurar que db.sqlite3 exista para el bind mount
touch "$APP_DIR/backend/db.sqlite3"

# ---------- Nginx: config HTTP temporal para validación certbot -------------
info "Creando config HTTP temporal para certbot..."
cat > "$NGINX_CONF_DIR/fincalc.conf" <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 'fincalc deploy in progress';
        add_header Content-Type text/plain;
    }
}
EOF

docker exec "$NGINX_CONTAINER" nginx -t || error "Config de nginx inválida."
docker exec "$NGINX_CONTAINER" nginx -s reload
info "nginx recargado con config HTTP."

# ---------- Obtener certificado SSL -----------------------------------------
info "Obteniendo certificado SSL para $DOMAIN..."
docker run --rm \
    -v abastolink_certbot_conf:/etc/letsencrypt \
    -v abastolink_certbot_www:/var/www/certbot \
    certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    -d "$DOMAIN" \
    --non-interactive \
    --agree-tos \
    --register-unsafely-without-email

info "Certificado obtenido."

# ---------- Nginx: config HTTPS definitiva ----------------------------------
info "Escribiendo config HTTPS definitiva..."
cat > "$NGINX_CONF_DIR/fincalc.conf" <<'NGINXEOF'
server {
    listen 80;
    server_name DOMAIN_PLACEHOLDER;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    http2 on;
    server_name DOMAIN_PLACEHOLDER;

    ssl_certificate /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;

    resolver 127.0.0.11 valid=10s;
    resolver_timeout 5s;

    client_max_body_size 20M;

    # Frontend SPA + static files
    location / {
        set $frontend http://fincalc_frontend:80;
        proxy_pass $frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
    }

    # Django API
    location /api/ {
        set $api http://fincalc_api:8000;
        proxy_pass $api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
    }

    # Django admin
    location /admin/ {
        set $api http://fincalc_api:8000;
        proxy_pass $api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
    }
}
NGINXEOF

# Reemplazar el placeholder con el dominio real
sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" "$NGINX_CONF_DIR/fincalc.conf"

# ---------- Buildear y levantar contenedores --------------------------------
info "Construyendo imágenes Docker..."
docker compose -f "$APP_DIR/deploy/docker-compose.yml" build

info "Levantando contenedores..."
docker compose -f "$APP_DIR/deploy/docker-compose.yml" up -d

# Esperar que los contenedores estén healthy
sleep 5
docker compose -f "$APP_DIR/deploy/docker-compose.yml" ps

# ---------- Recargar nginx con config final ---------------------------------
docker exec "$NGINX_CONTAINER" nginx -t || error "Config HTTPS de nginx inválida."
docker exec "$NGINX_CONTAINER" nginx -s reload
info "nginx recargado con config HTTPS."

# ---------- Resumen ---------------------------------------------------------
echo ""
echo -e "${GREEN}========================================================${NC}"
echo -e "${GREEN}  Despliegue completado exitosamente!${NC}"
echo -e "${GREEN}========================================================${NC}"
echo ""
echo -e "  URL:      https://$DOMAIN"
echo -e "  Logs API: docker logs fincalc_api -f"
echo -e "  Logs web: docker logs fincalc_frontend -f"
echo ""
echo -e "${YELLOW}  Para eliminar: bash $APP_DIR/deploy/cleanup.sh${NC}"
echo ""
