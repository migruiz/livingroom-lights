FROM node:8.16.0-alpine

RUN apk add --no-cache --upgrade bash git openssh subversion

RUN mkdir /app/
COPY app/package.json  /app/package.json

RUN cd /app \
&& npm  install 


COPY app /app

COPY syncToSVN.sh syncToSVN.sh 
COPY docker-entrypoint.sh docker-entrypoint.sh 
RUN chmod +x /docker-entrypoint.sh
RUN chmod +x /syncToSVN.sh

ENTRYPOINT ["/docker-entrypoint.sh"]