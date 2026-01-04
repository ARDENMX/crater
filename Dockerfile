# syntax=docker/dockerfile:1

#############################
# BUILD: PHP + Composer + Node (para compilar Vite)
#############################
FROM php:8.1.32-fpm-bookworm AS build

WORKDIR /var/www

ENV COMPOSER_ALLOW_SUPERUSER=1 \
    COMPOSER_HOME=/tmp

# PHP deps + extensiones
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

# Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Código
COPY . /var/www

# Dependencias PHP
RUN composer install \
    --no-dev \
    --prefer-dist \
    --no-interaction \
    --no-progress \
    --optimize-autoloader

# Crear .env en build (SIN php -r multiline) para que Vite/Laravel no se quejen
RUN if [ ! -f .env ]; then cp .env.example .env; fi \
 && printf "\nAPP_ENV=production\nAPP_DEBUG=false\nAPP_URL=http://localhost\nAPP_KEY=base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=\n" >> .env

# Node + Yarn (solo build)
# En Debian Bookworm, nodejs de apt suele ser 18.x; sirve para Vite :contentReference[oaicite:1]{index=1}
RUN apt-get update && apt-get install -y --no-install-recommends nodejs npm \
 && npm i -g yarn@1.22.22 \
 && rm -rf /var/lib/apt/lists/*

# Build frontend (aquí ya existe php, así que no falla `php artisan vite:config`)
RUN yarn install --frozen-lockfile || yarn install
RUN yarn build

# Limpieza opcional
RUN rm -rf node_modules


#############################
# RUNTIME: PHP-FPM (sin Node)
#############################
FROM php:8.1.32-fpm-bookworm AS php-runtime

WORKDIR /var/www

RUN apt-get update && apt-get install -y --no-install-recommends \
      libzip-dev \
      libpng-dev libjpeg62-turbo-dev libfreetype6-dev \
      libonig-dev \
      libxml2-dev \
      libcurl4-openssl-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" \
      pdo_mysql bcmath mbstring zip gd curl xml exif \
    && rm -rf /var/lib/apt/lists/*

# Permitir env vars en PHP-FPM (si no, Laravel puede “no ver” APP_KEY/DB_* en algunos setups)
RUN sed -i 's/^;*clear_env\s*=.*/clear_env = no/' /usr/local/etc/php-fpm.d/www.conf || true \
 && grep -q '^clear_env' /usr/local/etc/php-fpm.d/www.conf || echo 'clear_env = no' >> /usr/local/etc/php-fpm.d/www.conf

# Copia app ya construida
COPY --from=build /var/www /var/www

RUN mkdir -p storage bootstrap/cache \
 && chown -R www-data:www-data storage bootstrap/cache \
 && chmod -R 775 storage bootstrap/cache


#############################
# APP target
#############################
FROM php-runtime AS app
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["/usr/local/sbin/php-fpm","-F"]


#############################
# NGINX target
#############################
FROM nginx:1.25-alpine AS nginx
WORKDIR /var/www
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /var/www/public /var/www/public
