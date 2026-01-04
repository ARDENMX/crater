#!/bin/sh
set -e

cd /var/www

# Directorios que Laravel/Crater necesitan escribir
mkdir -p \
  storage \
  storage/app \
  storage/app/public \
  storage/framework \
  storage/framework/cache \
  storage/framework/sessions \
  storage/framework/views \
  storage/logs \
  bootstrap/cache

# Permisos
chown -R www-data:www-data storage bootstrap/cache || true
chmod -R 775 storage bootstrap/cache || true

# Limpia caches viejos (no debe tumbar el contenedor si falla)
php artisan optimize:clear >/dev/null 2>&1 || true

exec "$@"
