#!/bin/sh
set -e

cd /var/www

# Directorios que Laravel/Crater necesitan
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
chmod -R ug+rwX storage bootstrap/cache || true

# Crear .env si falta
if [ ! -f .env ]; then
  echo "[entrypoint] .env no existe, creando desde .env.example"
  cp .env.example .env
fi

# Inyectar variables desde ENV -> .env (con quoting/escape seguro)
php -r '
$f=".env";
$c=file_get_contents($f);

$escape=function($v){
  if($v===false || $v===null || $v==="") return null;
  $v=str_replace(["\r","\n"],"", (string)$v);

  // Si tiene espacios o # o comillas, lo guardamos como "..."
  if(preg_match("/\s|#|\"/", $v)){
    $v=str_replace(["\\", "\""], ["\\\\", "\\\""], $v);
    return "\"".$v."\"";
  }
  return $v;
};

$set=function($k,$v) use (&$c,$escape){
  $v=$escape($v);
  if($v===null) return;
  if(preg_match("/^".$k."=.*/m",$c)) $c=preg_replace("/^".$k."=.*/m",$k."=".$v,$c);
  else $c.="\n".$k."=".$v;
};

$set("APP_ENV", getenv("APP_ENV") ?: "production");
$set("APP_DEBUG", getenv("APP_DEBUG") ?: "false");
$set("APP_URL", getenv("APP_URL"));
$set("APP_KEY", getenv("APP_KEY"));

$set("DB_CONNECTION", getenv("DB_CONNECTION") ?: "mysql");
$set("DB_HOST", getenv("DB_HOST") ?: "db");
$set("DB_PORT", getenv("DB_PORT") ?: "3306");
$set("DB_DATABASE", getenv("DB_DATABASE") ?: "crater");
$set("DB_USERNAME", getenv("DB_USERNAME") ?: "crater");
$set("DB_PASSWORD", getenv("DB_PASSWORD"));

$set("MAIL_DRIVER", getenv("MAIL_MAILER") ?: "smtp");
$set("MAIL_MAILER", getenv("MAIL_MAILER"));
$set("MAIL_HOST", getenv("MAIL_HOST"));
$set("MAIL_PORT", getenv("MAIL_PORT"));
$set("MAIL_USERNAME", getenv("MAIL_USERNAME"));
$set("MAIL_PASSWORD", getenv("MAIL_PASSWORD"));
$set("MAIL_ENCRYPTION", getenv("MAIL_ENCRYPTION"));
$set("MAIL_FROM_ADDRESS", getenv("MAIL_FROM_ADDRESS"));
$set("MAIL_FROM_NAME", getenv("MAIL_FROM_NAME"));

file_put_contents($f, $c."\n");
'


# Limpia caches (si falla, deja logs)
php artisan optimize:clear || true

# storage link (sin reventar si ya existe o no permite symlink)
rm -rf public/storage 2>/dev/null || true
ln -s ../storage/app/public public/storage 2>/dev/null || true

# Esperar DB y migrar 1 vez
if [ ! -f storage/.migrated ]; then
  echo "[entrypoint] esperando DB..."
  i=0
  until php -r '
    $h=getenv("DB_HOST") ?: "db";
    $p=getenv("DB_PORT") ?: "3306";
    $d=getenv("DB_DATABASE") ?: "crater";
    $u=getenv("DB_USERNAME") ?: "crater";
    $pw=getenv("DB_PASSWORD") ?: "";
    new PDO("mysql:host=$h;port=$p;dbname=$d;charset=utf8mb4",$u,$pw,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
  ' >/dev/null 2>&1; do
    i=$((i+1))
    if [ $i -ge 30 ]; then
      echo "[entrypoint] DB no responde, seguimos para no bloquear"
      break
    fi
    sleep 2
  done

  echo "[entrypoint] corriendo migraciones..."
  php artisan migrate --force || true
  touch storage/.migrated
fi

exec "$@"
