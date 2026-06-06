#!/bin/bash
# Deploy calendar site using rsync instead of git clone
# Run from workspace directory

set -e

echo "📅 Deploying Calendar Site to Umbrel..."

# Ensure octiron is up to date
cd /home/aldus/.openclaw/workspace-stratford/octiron
git pull

# Create remote directory structure
echo "Creating remote directories..."
ssh -o StrictHostKeyChecking=no aldus@10.227.6.155 'sudo mkdir -p /opt/calendar-site/calendar-site && sudo mkdir -p /data/calendar'

# Rsync the calendar-site directory
echo "Syncing files to umbrel..."
cd /home/aldus/.openclaw/workspace-stratford/octiron
echo "rsync -avz --delete calendar-site/ aldus@10.227.6.155:/opt/calendar-site/calendar-site/"

# Deploy containers
echo "Building and starting containers..."
ssh -o StrictHostKeyChecking=no aldus@10.227.6.155 << 'REMOTE_COMMANDS'
cd /opt/calendar-site/calendar-site
sudo docker-compose -f docker-compose.prod.yml down 2>/dev/null || true
sudo docker-compose -f docker-compose.prod.yml up -d --build

# Wait for health check
echo "Waiting for backend to be healthy..."
for i in {1..20}; do
    if curl -s http://localhost:3006/health 2>/dev/null | grep -q "ok"; then
        echo "✅ Backend is healthy!"
        break
    fi
    echo "Waiting... ($i/20)"
    sleep 3
done

# Show status
echo ""
echo "📊 Deployment Status:"
sudo docker-compose -f docker-compose.prod.yml ps
REMOTE_COMMANDS

echo ""
echo "✅ Deployment complete!"
echo "🔗 URLs:"
echo "  Local: http://10.227.6.155:5176"
echo "  Public: https://calendar.dijibringabeeralong.co.za"