# syntax=docker/dockerfile:1

#############################
# PHP (Crater) - base
#############################
FROM php:8.2-fpm-bookworm AS php-base

WORKDIR /var/www

ENV COMPOSER_ALLOW_SUPERUSER=1 \
    COMPOSER_HOME=/tmp

# System deps + PHP extensions (según requirements de Crater/Laravel)
RUN apt-get update && apt-get install -y --no-install-recommends \
      git curl unzip zip \
      libzip-dev \
      libpng-dev libjpeg62-turbo-dev libfreetype6-dev \
      libonig-dev \
      libxml2-dev \
      libcurl4-openssl-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" \
      pdo_mysql bcmath mbstring zip gd curl xml \
    && rm -rf /var/lib/apt/lists/*

# Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Copia código
COPY . /var/www

# Instala dependencias PHP (sin scripts para evitar requerir .env en build)
RUN composer install \
    --no-dev \
    --prefer-dist \
    --no-interaction \
    --no-progress \
    --optimize-autoloader \
    --no-scripts

# Prepara dirs requeridos
RUN mkdir -p storage bootstrap/cache \
 && chown -R www-data:www-data storage bootstrap/cache \
 && chmod -R 775 storage bootstrap/cache

#############################
# APP (php-fpm)
#############################
FROM php-base AS app
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["/usr/local/sbin/php-fpm","-F"]

#############################
# NGINX
#############################
FROM nginx:1.25-alpine AS nginx

WORKDIR /var/www

# Config nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Solo necesitas el public/ para servir estáticos y validar try_files
COPY --from=php-base /var/www/public /var/www/public
