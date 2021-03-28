FROM balenalib/raspberrypi3-debian
RUN [ "cross-build-start" ]



RUN apt-get update && \
apt-get install -yqq --no-install-recommends g++ gcc make wget python-dev && apt -y install python-pip && rm -rf /var/lib/apt/lists/*


RUN mkdir /python-broadlink

COPY python-broadlink /python-broadlink

RUN cd /python-broadlink \
&& python -m pip install pycrypto  \
&& python -m pip install netaddr \
&& python -m pip install setuptools 

RUN curl -sL https://deb.nodesource.com/setup_8.x | bash - \
&& apt-get install -yqq --no-install-recommends nodejs   && rm -rf /var/lib/apt/lists/*

RUN mkdir /App/


COPY App/package.json  /App/package.json

RUN cd /App/ \
&& npm  install 

COPY App /App

RUN [ "cross-build-end" ]  

ENTRYPOINT ["node","/App/app.js"]



