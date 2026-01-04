# syntax=docker/dockerfile:1

#############################
# PHP (Crater) - base
#############################
FROM php:8.2-fpm-bookworm AS php-base

WORKDIR /var/www

ENV COMPOSER_ALLOW_SUPERUSER=1 \
    COMPOSER_HOME=/tmp

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

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Copia el código (desde el repo)
COPY . /var/www

# Instala dependencias PHP (sin scripts para no requerir .env en build)
RUN composer install \
    --no-dev \
    --prefer-dist \
    --no-interaction \
    --no-progress \
    --optimize-autoloader \
    --no-scripts

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

# Config nginx (este archivo TIENE que existir en el repo)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiamos public/ para servir estáticos y tener el root correcto
COPY --from=php-base /var/www/public /var/www/public
