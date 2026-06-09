#!/bin/sh
set -e
python manage.py migrate --noinput
exec gunicorn \
    --workers 3 \
    --bind 0.0.0.0:8000 \
    --access-logfile - \
    --error-logfile - \
    config.wsgi:application
