FROM php:8.3-apache

RUN docker-php-ext-install pdo pdo_mysql \
    && a2enmod rewrite \
    && printf '<Directory /var/www/html>\n    AllowOverride All\n</Directory>\n' > /etc/apache2/conf-available/override.conf \
    && a2enconf override

WORKDIR /var/www/html
COPY public/ /var/www/html/
COPY config/ /var/www/config/
