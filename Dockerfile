FROM balenalib/raspberrypi3-alpine-node:8-latest
RUN [ "cross-build-start" ]


RUN apk add --update make python3-dev python3 g++ 

RUN mkdir /python-broadlink

COPY python-broadlink /python-broadlink

RUN cd /python-broadlink \
&& python -m pip install pycrypto  \
&& python -m pip install netaddr \
&& python setup.py install

RUN chmod +x /python-broadlink/cli/broadlink_cli
RUN chmod +x /python-broadlink/cli/broadlink_discovery

RUN mkdir /App/
COPY App/package.json  /App/package.json


RUN cd /App \
&& npm  install 


COPY App /App

RUN [ "cross-build-end" ]  

ENTRYPOINT ["node","/App/app.js"]