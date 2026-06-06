#!/bin/bash
# Manual deployment script for calendar site on umbrel
# Run this on umbrel (10.227.6.155) as aldus user

APP_DIR=/opt/calendar-site
DATA_DIR=/data/calendar
GIT_REPO=https://bitbucket.org/pYr0G3ist/octiron.git

echo "📅 Deploying Calendar Site..."

# Create data directory
sudo mkdir -p $DATA_DIR

# Clone or update
if [ -d "$APP_DIR/.git" ]; then
    echo "Updating existing repository..."
    cd $APP_DIR && sudo git pull
else
    echo "Cloning repository..."
    sudo git clone $GIT_REPO $APP_DIR
fi

# Deploy containers
echo "Building and starting containers..."
cd $APP_DIR/calendar-site
sudo docker-compose -f docker-compose.prod.yml down 2>/dev/null || true
sudo docker-compose -f docker-compose.prod.yml up -d --build

# Wait for health check
echo "Waiting for backend to be healthy..."
for i in {1..15}; do
    if curl -s http://localhost:3006/health | grep -q "ok"; then
        echo "✅ Backend is healthy!"
        break
    fi
    echo "Waiting... ($i/15)"
    sleep 3
done

# Show status
echo ""
echo "📊 Deployment Status:"
sudo docker-compose -f docker-compose.prod.yml ps
echo ""
echo "🔗 URLs:"
echo "  Frontend: http://10.227.6.155:5176"
echo "  API: http://10.227.6.155:3006/api"
echo "  Health: curl http://10.227.6.155:3006/health"