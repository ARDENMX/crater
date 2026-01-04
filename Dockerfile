# syntax=docker/dockerfile:1

#############################
# Frontend build (Yarn)
#############################
FROM node:18-alpine AS assets
WORKDIR /var/www

# Corepack viene con Node y permite usar Yarn sin instalarlo globalmente
# (y evita el EEXIST de /usr/local/bin/yarn)
RUN corepack enable || true

# Si por alguna razón yarn no está en PATH, instálalo forzando overwrite
RUN if ! command -v yarn >/dev/null 2>&1; then npm i -g yarn --force; fi

# Copia primero manifests para cache
COPY package.json yarn.lock* ./
RUN yarn install --frozen-lockfile || yarn install

# Copia el resto del proyecto y compila
COPY . .
RUN yarn build


#############################
# PHP (Crater) - base
#############################
FROM php:8.1.32-fpm-bookworm AS php-base

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
      pdo_mysql bcmath mbstring zip gd curl xml exif \
    && rm -rf /var/lib/apt/lists/*

# Deja pasar env vars a PHP-FPM
RUN sed -i 's/^;*clear_env\s*=.*/clear_env = no/' /usr/local/etc/php-fpm.d/www.conf || true \
 && grep -q '^clear_env' /usr/local/etc/php-fpm.d/www.conf || echo 'clear_env = no' >> /usr/local/etc/php-fpm.d/www.conf

# Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Código
COPY . /var/www

# Copia assets compilados al public/
COPY --from=assets /var/www/public /var/www/public

# Composer deps
RUN composer install \
    --no-dev \
    --prefer-dist \
    --no-interaction \
    --no-progress \
    --optimize-autoloader

# Dirs requeridos
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
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=php-base /var/www/public /var/www/public
