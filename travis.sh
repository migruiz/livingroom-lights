#!/bin/bash  
set -ev
HUBNAME=migruiz/livingroom-lights;
docker pull $HUBNAME || true
docker build  --cache-from $HUBNAME  -t $HUBNAME  -f Dockerfile .
echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin 
docker push $HUBNAME  
