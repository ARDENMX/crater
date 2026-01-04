#!/bin/sh
set -e

cd /var/www

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

chown -R www-data:www-data storage bootstrap/cache || true
chmod -R 775 storage bootstrap/cache || true

php artisan optimize:clear >/dev/null 2>&1 || true

exec "$@"
