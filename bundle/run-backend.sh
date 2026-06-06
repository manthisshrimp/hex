#!/bin/sh
# Read the current password from file at each (re)start so supervisorctl restarts
# pick up password changes made via the dashboard.
PW=$(cat /etc/octiron-admin.pwd 2>/dev/null)
if [ -n "$PW" ]; then
    export ADMIN_PASSWORD="$PW"
fi
exec "$@"
