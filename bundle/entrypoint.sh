#!/bin/sh
# Bootstrap the password file from env on first run so backends can read it.
if [ ! -f /etc/octiron-admin.pwd ]; then
    printf '%s' "$ADMIN_PASSWORD" > /etc/octiron-admin.pwd
    chmod 600 /etc/octiron-admin.pwd
fi
exec /usr/bin/supervisord -n -c /etc/supervisor/supervisord.conf
