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

# Prevent processes for user from ending when session ends
loginctl enable-linger "${NEW_USER_NAME}"

# Set up ipv4 iptables
/usr/sbin/iptables -F
/usr/sbin/iptables -P OUTPUT ACCEPT
/usr/sbin/iptables -P INPUT DROP
/usr/sbin/iptables -P FORWARD DROP
/usr/sbin/iptables -A FORWARD -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
/usr/sbin/iptables -A INPUT -i lo -j ACCEPT
/usr/sbin/iptables -A OUTPUT -o lo -j ACCEPT
/usr/sbin/iptables -A INPUT -p tcp -m multiport --dports 80,443,22 -m conntrack --ctstate NEW,ESTABLISHED,RELATED -j ACCEPT
# Set up ipv6 iptables
/usr/sbin/ip6tables -F
/usr/sbin/ip6tables -P OUTPUT ACCEPT
/usr/sbin/ip6tables -P INPUT DROP
/usr/sbin/ip6tables -P FORWARD DROP
/usr/sbin/ip6tables -A INPUT -i lo -j ACCEPT
/usr/sbin/ip6tables -A OUTPUT -o lo -j ACCEPT
/usr/sbin/ip6tables -A INPUT -p tcp -m multiport --dports 80,443 -m conntrack --ctstate NEW,ESTABLISHED -j ACCEPT
# Allow rootless users to send "pings"
# https://www.redhat.com/sysadmin/container-networking-podman
# sysctl -w "net.ipv4.ping_group_range=0 2000000"

# Lower priviledged port start to allow rootless nginx container to listen on 80
sysctl net.ipv4.ip_unprivileged_port_start=80

# SSH config
echo "PermitRootLogin no" >> /etc/ssh/ssh_config.d/custom.conf
echo "PasswordAuthentication no" >> /etc/ssh/ssh_config.d/custom.conf
echo "AddressFamily inet" >> /etc/ssh/ssh_config.d/custom.conf
systemctl restart sshd

echo "System configured for running server. New user ${NEW_USER_NAME} created."
