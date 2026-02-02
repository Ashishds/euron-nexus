#!/bin/bash
# =============================================
# Get SSL Certificate for mydatainterview.in
# =============================================

set -e

echo "🔒 Getting SSL Certificate..."

# Stop any existing nginx
docker stop euron-nginx-temp 2>/dev/null || true
docker rm euron-nginx-temp 2>/dev/null || true
docker-compose stop nginx 2>/dev/null || true

# Get certificate
docker run -it --rm \
    -v $(pwd)/certbot/conf:/etc/letsencrypt \
    -v $(pwd)/certbot/www:/var/www/certbot \
    -p 80:80 \
    certbot/certbot certonly \
    --standalone \
    --email your-email@example.com \
    --agree-tos \
    --no-eff-email \
    -d mydatainterview.in \
    -d www.mydatainterview.in

# Check if certificate was obtained
if [ -f "certbot/conf/live/mydatainterview.in/fullchain.pem" ]; then
    echo "✅ SSL Certificate obtained successfully!"
    
    # Start with full SSL config
    docker-compose up -d
    
    echo ""
    echo "🎉 HTTPS is now enabled!"
    echo "Visit: https://www.mydatainterview.in"
else
    echo "❌ Failed to obtain SSL certificate."
    echo "Make sure:"
    echo "  1. DNS is pointing to this server"
    echo "  2. Port 80 is open in security group"
    echo "  3. No other service is using port 80"
fi
