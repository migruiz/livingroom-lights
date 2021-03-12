#!/bin/sh
set -e

#
rm -rf /root/.ssh
mkdir /root/.ssh
chmod 600 /root/.ssh
cat > /root/.ssh/config <<-ConfigHD
Host    *
		UserKnownHostsFile        /dev/null
		StrictHostKeyChecking     no
		TCPKeepAlive              no
		ServerAliveInterval       5
		ServerAliveCountMax       3
		ExitOnForwardFailure      yes
GatewayPorts=yes
ConfigHD
chmod 600 /root/.ssh/config
cp /secrets/id_rsa /root/.ssh/id_rsa
chmod 600 /root/.ssh/id_rsa



exec  node /app/app.js