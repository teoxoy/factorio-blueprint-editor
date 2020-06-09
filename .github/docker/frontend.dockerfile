FROM nginx:1.18.0-alpine

WORKDIR /usr/share/nginx/html
COPY . .
RUN mv nginx.conf /etc/nginx/nginx.conf