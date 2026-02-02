#!/bin/bash
# =============================================
# Quick Deploy Script for MyData Interview
# Run this on your EC2 instance
# =============================================

set -e

echo "🚀 Starting MyData Interview Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as correct user
if [ "$EUID" -eq 0 ]; then 
    echo -e "${RED}Please don't run as root. Run as ec2-user or ubuntu.${NC}"
    exit 1
fi

# Function to check command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Step 1: Check Docker
echo -e "${YELLOW}Step 1: Checking Docker...${NC}"
if command_exists docker; then
    echo -e "${GREEN}✓ Docker is installed${NC}"
else
    echo -e "${RED}Docker not found. Installing...${NC}"
    sudo yum install -y docker 2>/dev/null || sudo apt install -y docker.io
    sudo systemctl start docker
    sudo systemctl enable docker
    sudo usermod -aG docker $USER
    echo -e "${GREEN}✓ Docker installed. Please logout and login again, then re-run this script.${NC}"
    exit 0
fi

# Step 2: Check Docker Compose
echo -e "${YELLOW}Step 2: Checking Docker Compose...${NC}"
if command_exists docker-compose; then
    echo -e "${GREEN}✓ Docker Compose is installed${NC}"
else
    echo -e "${RED}Docker Compose not found. Installing...${NC}"
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo -e "${GREEN}✓ Docker Compose installed${NC}"
fi

# Step 3: Create directories
echo -e "${YELLOW}Step 3: Creating required directories...${NC}"
mkdir -p certbot/conf certbot/www nginx/ssl
echo -e "${GREEN}✓ Directories created${NC}"

# Step 4: Build and start application
echo -e "${YELLOW}Step 4: Building application...${NC}"
docker-compose build --no-cache
echo -e "${GREEN}✓ Application built${NC}"

# Step 5: Start services
echo -e "${YELLOW}Step 5: Starting services...${NC}"
docker-compose up -d euron-app
echo -e "${GREEN}✓ Application started${NC}"

# Step 6: Check if SSL cert exists
if [ -f "certbot/conf/live/mydatainterview.in/fullchain.pem" ]; then
    echo -e "${GREEN}✓ SSL certificate found. Starting with HTTPS...${NC}"
    docker-compose up -d
else
    echo -e "${YELLOW}⚠ No SSL certificate found.${NC}"
    echo -e "${YELLOW}Starting HTTP only for now. Run get-ssl.sh to get SSL certificate.${NC}"
    
    # Create temporary HTTP-only nginx config
    cat > nginx/nginx-temp.conf << 'NGINXEOF'
events { worker_connections 1024; }
http {
    include /etc/nginx/mime.types;
    upstream euron_app { server euron-app:3000; }
    server {
        listen 80;
        server_name mydatainterview.in www.mydatainterview.in;
        location /.well-known/acme-challenge/ { root /var/www/certbot; }
        location / {
            proxy_pass http://euron_app;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }
}
NGINXEOF
    
    # Start nginx with temp config
    docker run -d --name euron-nginx-temp \
        --network euron-intervie-ai-agent_euron-network \
        -p 80:80 \
        -v $(pwd)/nginx/nginx-temp.conf:/etc/nginx/nginx.conf:ro \
        -v $(pwd)/certbot/www:/var/www/certbot:ro \
        nginx:alpine
fi

# Step 7: Health check
echo -e "${YELLOW}Step 6: Running health check...${NC}"
sleep 5
if curl -s http://localhost:3000/api/health | grep -q "healthy"; then
    echo -e "${GREEN}✓ Application is healthy!${NC}"
else
    echo -e "${RED}✗ Health check failed. Check logs with: docker-compose logs${NC}"
fi

# Summary
echo ""
echo "=========================================="
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo "=========================================="
echo ""
echo "Your application is now running."
echo ""
echo "If you haven't set up SSL yet, run:"
echo "  ./get-ssl.sh"
echo ""
echo "Test locally: curl http://localhost:3000/api/health"
echo ""
