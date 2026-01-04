# syntax=docker/dockerfile:1

#############################
# BUILD: PHP + Composer + Node (solo para compilar)
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

# Copia código
COPY . /var/www

# Composer deps (tu lock requiere PHP < 8.2, por eso estamos en 8.1)
RUN composer install \
    --no-dev \
    --prefer-dist \
    --no-interaction \
    --no-progress \
    --optimize-autoloader

# Crear .env para que Artisan/Vite pueda leer configuración durante el build
# (se sobreescribe en runtime por tu entrypoint)
RUN if [ ! -f .env ]; then cp .env.example .env; fi \
 && php -r '
  $f=".env"; $c=file_get_contents($f);
  $set=function($k,$v) use (&$c){
    if($v===null||$v==="") return;
    if(preg_match("/^".$k."=.*/m",$c)) $c=preg_replace("/^".$k."=.*/m",$k."=".$v,$c);
    else $c.="\n".$k."=".$v;
  };
  $set("APP_ENV","production");
  $set("APP_DEBUG","false");
  $set("APP_URL","http://localhost");
  $set("APP_KEY","base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");
  file_put_contents($f,$c);
 '

# Node + Yarn SOLO para compilar assets (en Bookworm nodejs es 18.x)
RUN apt-get update && apt-get install -y --no-install-recommends nodejs npm \
 && npm i -g yarn@1.22.22 \
 && rm -rf /var/lib/apt/lists/*

# Build frontend (aquí ya existe php, así que `php artisan vite:config` funciona)
RUN yarn install --frozen-lockfile || yarn install
RUN yarn build

# Limpieza (opcional)
RUN rm -rf node_modules


#############################
# RUNTIME: PHP-FPM (sin Node)
#############################
FROM php:8.1.32-fpm-bookworm AS php-runtime

WORKDIR /var/www

# PHP deps + extensiones (runtime)
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

# Importante: permitir env vars en FPM (para APP_KEY/DB_* desde Dokploy)
RUN sed -i 's/^;*clear_env\s*=.*/clear_env = no/' /usr/local/etc/php-fpm.d/www.conf || true \
 && grep -q '^clear_env' /usr/local/etc/php-fpm.d/www.conf || echo 'clear_env = no' >> /usr/local/etc/php-fpm.d/www.conf

# Copia la app ya “builded” (vendor + public build)
COPY --from=build /var/www /var/www

# Permisos base
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
