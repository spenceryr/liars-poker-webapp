#!/bin/bash

# Required external env variables:
# EXT_SERVER_USER_PASSWORD: Password for new server user.

set -e

if [ $(id -u) -ne 0 ]; then
  echo "Please run as root"
  exit 1
fi

apt update -y
apt upgrade -y

# User mode networking and podman install
apt install -y slirp4netns podman

# Increase num of user namespaces
echo "user.max_user_namespaces=28633" > /etc/sysctl.d/userns.conf
sysctl -p /etc/sysctl.d/userns.conf

NEW_USER_NAME=server
useradd -c "Server User" -m "${NEW_USER_NAME}"
if [ -z ${EXT_SERVER_USER_PASSWORD} ]; then
  read -p "Enter password for ${NEW_USER_NAME} user: " EXT_SERVER_USER_PASSWORD
fi
echo "${NEW_USER_NAME}:${EXT_SERVER_USER_PASSWORD}" | chpasswd

# Set up ssh for new user so we can both ssh in as the new user and also ssh from localhost
# mkdir "/home/${NEW_USER_NAME}/.ssh"
# su "${NEW_USER_NAME}" -c ssh-keygen -f "/home/${NEW_USER_NAME}/.ssh/id_rsa" -P ""

# Prevent processes for user from ending when session ends
loginctl enable-linger "${NEW_USER_NAME}"

# Set up iptables
/usr/sbin/iptables -A INPUT -i lo -j ACCEPT
/usr/sbin/iptables -A OUTPUT -o lo -j ACCEPT
/usr/sbin/iptables -A INPUT -p tcp -m multiport --dports 80,443,22 -m conntrack --ctstate NEW,ESTABLISHED -j ACCEPT
# /usr/sbin/iptables -A OUTPUT -p tcp -m multiport --dports 80,443,22 -m conntrack --ctstate ESTABLISHED -j ACCEPT
/usr/sbin/ip6tables -A INPUT -p tcp -m multiport --dports 80,443 -m conntrack --ctstate NEW,ESTABLISHED -j ACCEPT
# /usr/sbin/ip6tables -A OUTPUT -p tcp -m multiport --dports 80,443 -m conntrack --ctstate ESTABLISHED -j ACCEPT

# Allow rootless users to send "pings"
# https://www.redhat.com/sysadmin/container-networking-podman
sysctl -w "net.ipv4.ping_group_range=0 2000000"

# Lower priviledged port start to allow rootless nginx container to listen on 80
sysctl net.ipv4.ip_unprivileged_port_start=80

# SSH config
echo "PermitRootLogin no" >> /etc/ssh/ssh_config.d/custom.conf
echo "PasswordAuthentication no" >> /etc/ssh/ssh_config.d/custom.conf
echo "AddressFamily inet" >> /etc/ssh/ssh_config.d/custom.conf
systemctl restart sshd

echo "System configured for running server. New user ${NEW_USER_NAME} created."

# apt update
# apt upgrade (?)
# Maybe set up user?
# Setup up iptables for ssh (should not be necessary), http, and https
# Remove certbot if installed with apt
# Install snapd and certbot (https://certbot.eff.org/instructions?ws=nginx&os=ubuntufocal&tab=wildcard)
# Install podman
# Set up env file? (Maybe create an "env creator" script)
# Create self-signed certs as well as lets encrypt cert and place in correct places (corresponding to expected volume mounts).
# Pull down images
# Create self signed cert for node server
# Use quadlet to start systemd processes for pod
