#!/bin/bash
# =============================================================================
# deploy.sh — Despliega fincalc.abastolink.cloud en la VPS
# Ejecutar como root: bash deploy.sh
# =============================================================================
set -e

# ---------- Configuración ---------------------------------------------------
DOMAIN="fincalc.abastolink.cloud"
REPO="https://github.com/ArianCalabrese/utn-mba-finanzas"
APP_DIR="/var/www/fincalc"
SERVICE_NAME="fincalc"
SOCK_FILE="$APP_DIR/fincalc.sock"
PYTHON="python3"

# ---------- Colores para output ---------------------------------------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC} $1"; }
warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ---------- Verificaciones previas ------------------------------------------
info "Verificando sistema..."
[[ $EUID -ne 0 ]] && error "Este script debe ejecutarse como root."

# Verificar que el DNS ya apunta a esta IP antes de pedir el certificado
SERVER_IP=$(curl -s ifconfig.me)
DNS_IP=$(dig +short "$DOMAIN" | tail -1)
if [[ "$DNS_IP" != "$SERVER_IP" ]]; then
    warning "El DNS de $DOMAIN ($DNS_IP) todavía no apunta a esta IP ($SERVER_IP)."
    warning "Certbot fallará. Asegúrate de haber creado el registro A en Hostinger antes de continuar."
    read -p "¿Continuar de todas formas? (s/N): " RESP
    [[ "$RESP" != "s" && "$RESP" != "S" ]] && exit 1
fi

# ---------- Instalar dependencias del sistema --------------------------------
info "Instalando dependencias del sistema..."
apt-get update -q
apt-get install -y -q \
    python3 python3-venv python3-pip \
    nginx certbot python3-certbot-nginx \
    git curl dnsutils

# Node.js — instalar si no existe
if ! command -v node &>/dev/null; then
    info "Instalando Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y -q nodejs
fi
info "Node $(node -v) | npm $(npm -v)"

# ---------- Clonar / actualizar repositorio ---------------------------------
info "Configurando repositorio en $APP_DIR..."
if [[ -d "$APP_DIR/.git" ]]; then
    info "Repositorio ya existe — haciendo git pull..."
    git -C "$APP_DIR" pull
else
    git clone "$REPO" "$APP_DIR"
fi

# ---------- Backend: virtualenv + dependencias ------------------------------
info "Configurando backend Django..."
BACKEND_DIR="$APP_DIR/backend"
VENV_DIR="$BACKEND_DIR/venv"

if [[ ! -d "$VENV_DIR" ]]; then
    $PYTHON -m venv "$VENV_DIR"
fi
"$VENV_DIR/bin/pip" install --quiet --upgrade pip
"$VENV_DIR/bin/pip" install --quiet -r "$BACKEND_DIR/requirements.txt"
"$VENV_DIR/bin/pip" install --quiet gunicorn

# ---------- Archivo .env del backend ----------------------------------------
ENV_FILE="$BACKEND_DIR/.env"
if [[ ! -f "$ENV_FILE" ]]; then
    info "Creando archivo .env del backend..."
    SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(50))")
    cat > "$ENV_FILE" <<EOF
SECRET_KEY=$SECRET_KEY
DEBUG=False
ALLOWED_HOSTS=$DOMAIN,www.$DOMAIN,localhost
CORS_ALLOWED_ORIGINS=https://$DOMAIN,https://www.$DOMAIN
EOF
    info ".env creado en $ENV_FILE"
else
    info ".env ya existe — no se sobreescribe."
fi

# ---------- Migraciones y static files --------------------------------------
info "Ejecutando migraciones..."
cd "$BACKEND_DIR"
"$VENV_DIR/bin/python" manage.py migrate --noinput

info "Recolectando archivos estáticos..."
"$VENV_DIR/bin/python" manage.py collectstatic --noinput

# ---------- Frontend: build con Vite ----------------------------------------
info "Construyendo frontend..."
FRONTEND_DIR="$APP_DIR/frontend"
cd "$FRONTEND_DIR"
npm install --silent
VITE_API_URL="https://$DOMAIN/api" npm run build
info "Frontend compilado en $FRONTEND_DIR/dist"

# ---------- Permisos --------------------------------------------------------
# www-data necesita escribir el socket, la DB SQLite y su WAL journal
info "Ajustando permisos..."
chown -R www-data:www-data "$APP_DIR"
chmod -R 755 "$APP_DIR"
# Backend dir: ejecutable para navegar, pero no listable desde fuera
chmod 750 "$BACKEND_DIR"
# SQLite necesita escritura en el archivo y en el directorio padre
touch "$BACKEND_DIR/db.sqlite3"
chown www-data:www-data "$BACKEND_DIR/db.sqlite3"
chmod 664 "$BACKEND_DIR/db.sqlite3"

# ---------- Systemd: servicio Gunicorn --------------------------------------
info "Creando servicio systemd $SERVICE_NAME..."
cat > "/etc/systemd/system/$SERVICE_NAME.service" <<EOF
[Unit]
Description=Gunicorn para fincalc ($DOMAIN)
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=$BACKEND_DIR
EnvironmentFile=$ENV_FILE
ExecStart=$VENV_DIR/bin/gunicorn \\
    --workers 3 \\
    --bind unix:$SOCK_FILE \\
    --access-logfile /var/log/$SERVICE_NAME-access.log \\
    --error-logfile /var/log/$SERVICE_NAME-error.log \\
    config.wsgi:application
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"
info "Servicio $SERVICE_NAME activo: $(systemctl is-active $SERVICE_NAME)"

# ---------- NGINX: sitio virtual --------------------------------------------
info "Configurando NGINX..."
NGINX_CONF="/etc/nginx/sites-available/$SERVICE_NAME"
cat > "$NGINX_CONF" <<EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    # Frontend SPA
    root $FRONTEND_DIR/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Backend API + Admin
    location ~ ^/(api|admin)/ {
        proxy_pass http://unix:$SOCK_FILE;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Django static files (admin CSS, etc.)
    location /static/ {
        alias $BACKEND_DIR/staticfiles/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
EOF

ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/$SERVICE_NAME"
nginx -t || error "Configuración de NGINX inválida."
systemctl reload nginx

# ---------- Certificado SSL con Certbot ------------------------------------
info "Obteniendo certificado SSL para $DOMAIN..."
certbot --nginx \
    -d "$DOMAIN" \
    --non-interactive \
    --agree-tos \
    --register-unsafely-without-email \
    --redirect

systemctl reload nginx

# ---------- Resumen ---------------------------------------------------------
echo ""
echo -e "${GREEN}========================================================${NC}"
echo -e "${GREEN}  Despliegue completado exitosamente!${NC}"
echo -e "${GREEN}========================================================${NC}"
echo ""
echo -e "  URL:        https://$DOMAIN"
echo -e "  App dir:    $APP_DIR"
echo -e "  Servicio:   systemctl status $SERVICE_NAME"
echo -e "  Logs API:   tail -f /var/log/$SERVICE_NAME-error.log"
echo -e "  Logs NGINX: tail -f /var/log/nginx/error.log"
echo ""
echo -e "${YELLOW}  Para eliminar todo: bash $APP_DIR/deploy/cleanup.sh${NC}"
echo ""
