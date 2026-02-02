# 🚀 AWS Deployment Guide for www.mydatainterview.in

This guide will help you deploy Euron Nexus to AWS EC2 with your custom domain.

---

## 📋 Prerequisites

Before starting, you'll need:

1. ✅ AWS Account with EC2 access
2. ✅ Domain `mydatainterview.in` registered
3. ✅ Access to your domain's DNS settings
4. ✅ SSH key pair for EC2

---

## 🏗️ Step 1: Launch EC2 Instance

### 1.1 Go to AWS Console
- Login to AWS Console: https://console.aws.amazon.com
- Navigate to EC2 > Instances > Launch Instance

### 1.2 Configure Instance
| Setting | Value |
|---------|-------|
| Name | `euron-nexus-production` |
| AMI | Amazon Linux 2023 or Ubuntu 22.04 LTS |
| Instance Type | `t3.small` (minimum) or `t3.medium` (recommended) |
| Key Pair | Create new or select existing |
| Storage | 20 GB gp3 |

### 1.3 Security Group Settings
Create a new security group with these rules:

| Type | Port | Source | Description |
|------|------|--------|-------------|
| SSH | 22 | Your IP | SSH access |
| HTTP | 80 | 0.0.0.0/0 | Web traffic |
| HTTPS | 443 | 0.0.0.0/0 | Secure web traffic |

### 1.4 Launch Instance
Click "Launch Instance" and wait for it to start.

---

## 🌐 Step 2: Configure Domain DNS

### 2.1 Get Your EC2 Public IP
- Go to EC2 Dashboard
- Click on your instance
- Copy the **Public IPv4 address** (e.g., `13.234.xx.xx`)

### 2.2 Configure DNS Records
Go to your domain registrar (GoDaddy, Namecheap, Route53, etc.) and add:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ | `YOUR_EC2_IP` | 300 |
| A | www | `YOUR_EC2_IP` | 300 |

**Example:**
```
A     @     13.234.56.78    300
A     www   13.234.56.78    300
```

Wait 5-10 minutes for DNS to propagate.

---

## 🖥️ Step 3: Connect to EC2 & Install Dependencies

### 3.1 Connect via SSH
```bash
# From your local machine
ssh -i "your-key.pem" ec2-user@YOUR_EC2_IP

# Or for Ubuntu:
ssh -i "your-key.pem" ubuntu@YOUR_EC2_IP
```

### 3.2 Update System
```bash
# For Amazon Linux 2023
sudo yum update -y

# For Ubuntu
sudo apt update && sudo apt upgrade -y
```

### 3.3 Install Docker
```bash
# For Amazon Linux 2023
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER

# For Ubuntu
sudo apt install -y docker.io
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
```

### 3.4 Install Docker Compose
```bash
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 3.5 Install Git
```bash
# Amazon Linux
sudo yum install -y git

# Ubuntu
sudo apt install -y git
```

### 3.6 Logout and Login Again
```bash
exit
# Then SSH again to apply docker group
ssh -i "your-key.pem" ec2-user@YOUR_EC2_IP
```

---

## 📦 Step 4: Deploy Application

### 4.1 Clone Your Repository
```bash
cd ~
git clone https://github.com/YOUR_USERNAME/euron-nexus.git
cd euron-nexus
```

**OR** Copy files directly:
```bash
# From your local machine
scp -i "your-key.pem" -r f:\euron-intervie-ai-agent ec2-user@YOUR_EC2_IP:~/euron-nexus
```

### 4.2 Create Required Directories
```bash
cd ~/euron-nexus
mkdir -p certbot/conf certbot/www nginx/ssl
```

### 4.3 Create Initial Nginx Config (Without SSL first)
```bash
cat > nginx/nginx-initial.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    upstream euron_app {
        server euron-app:3000;
    }

    server {
        listen 80;
        server_name mydatainterview.in www.mydatainterview.in;

        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        location / {
            proxy_pass http://euron_app;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
EOF
```

### 4.4 Start Application (Without SSL first)
```bash
# Use initial nginx config
cp nginx/nginx-initial.conf nginx/nginx.conf

# Build and start
docker-compose up -d euron-app

# Start nginx with HTTP only
docker run -d --name euron-nginx \
  --network euron-intervie-ai-agent_euron-network \
  -p 80:80 \
  -v $(pwd)/nginx/nginx.conf:/etc/nginx/nginx.conf:ro \
  -v $(pwd)/certbot/www:/var/www/certbot:ro \
  nginx:alpine
```

### 4.5 Test HTTP Access
Open in browser: `http://mydatainterview.in`

If it works, continue to SSL setup!

---

## 🔒 Step 5: Setup SSL Certificate (HTTPS)

### 5.1 Stop Nginx Temporarily
```bash
docker stop euron-nginx
docker rm euron-nginx
```

### 5.2 Get SSL Certificate from Let's Encrypt
```bash
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
```

**Replace `your-email@example.com` with your actual email!**

### 5.3 Verify Certificate
```bash
ls -la certbot/conf/live/mydatainterview.in/
# You should see: fullchain.pem, privkey.pem, etc.
```

### 5.4 Use Full Nginx Config with SSL
```bash
# Copy the production nginx config
cp nginx/nginx.conf.bak nginx/nginx.conf 2>/dev/null || true
# The nginx.conf file should already have SSL configuration
```

### 5.5 Restart Everything with SSL
```bash
docker-compose down
docker-compose up -d
```

### 5.6 Test HTTPS
Open: `https://www.mydatainterview.in`

You should see a green padlock 🔒

---

## 🔄 Step 6: Setup Auto-Renewal for SSL

### 6.1 Create Renewal Script
```bash
cat > ~/renew-ssl.sh << 'EOF'
#!/bin/bash
cd ~/euron-nexus
docker run --rm \
  -v $(pwd)/certbot/conf:/etc/letsencrypt \
  -v $(pwd)/certbot/www:/var/www/certbot \
  certbot/certbot renew --quiet
docker-compose exec nginx nginx -s reload
EOF

chmod +x ~/renew-ssl.sh
```

### 6.2 Setup Cron Job
```bash
# Open crontab
crontab -e

# Add this line (renews at 3 AM daily)
0 3 * * * /home/ec2-user/renew-ssl.sh >> /var/log/ssl-renewal.log 2>&1
```

---

## ✅ Step 7: Verify Deployment

### 7.1 Check All Services
```bash
docker-compose ps
```

Expected output:
```
NAME           STATUS    PORTS
euron-nexus    Up        0.0.0.0:3000->3000/tcp
euron-nginx    Up        0.0.0.0:80->80, 0.0.0.0:443->443/tcp
```

### 7.2 Check Logs
```bash
# Application logs
docker-compose logs euron-app

# Nginx logs
docker-compose logs nginx
```

### 7.3 Test All URLs

| URL | Expected |
|-----|----------|
| https://mydatainterview.in | Landing page |
| https://www.mydatainterview.in | Landing page |
| https://www.mydatainterview.in/super-admin | Admin dashboard |
| https://www.mydatainterview.in/organizations | Organizations page |
| https://www.mydatainterview.in/interview | AI Interview demo |
| https://www.mydatainterview.in/candidate | Candidate portal |
| https://www.mydatainterview.in/api/health | {"status":"healthy"} |

---

## 🛠️ Maintenance Commands

### Restart Application
```bash
cd ~/euron-nexus
docker-compose restart
```

### View Logs
```bash
docker-compose logs -f
```

### Update Application
```bash
cd ~/euron-nexus
git pull  # If using git
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Check Disk Space
```bash
df -h
```

### Cleanup Docker
```bash
docker system prune -a
```

---

## 📊 Monitoring (Optional)

### Install CloudWatch Agent
```bash
sudo yum install -y amazon-cloudwatch-agent
```

### Basic Health Check Script
```bash
cat > ~/health-check.sh << 'EOF'
#!/bin/bash
response=$(curl -s -o /dev/null -w "%{http_code}" https://www.mydatainterview.in/api/health)
if [ $response != "200" ]; then
    echo "Site is down! Response: $response"
    # Add email/SMS notification here
fi
EOF

chmod +x ~/health-check.sh

# Add to crontab (runs every 5 minutes)
crontab -e
# Add: */5 * * * * /home/ec2-user/health-check.sh
```

---

## 🆘 Troubleshooting

### Site Not Loading
```bash
# Check if containers are running
docker-compose ps

# Check nginx logs
docker-compose logs nginx

# Check app logs
docker-compose logs euron-app

# Restart everything
docker-compose restart
```

### SSL Certificate Issues
```bash
# Check certificate
docker run --rm \
  -v $(pwd)/certbot/conf:/etc/letsencrypt \
  certbot/certbot certificates

# Force renewal
docker run --rm \
  -v $(pwd)/certbot/conf:/etc/letsencrypt \
  -v $(pwd)/certbot/www:/var/www/certbot \
  certbot/certbot renew --force-renewal
```

### Port Already in Use
```bash
# Find what's using port 80
sudo lsof -i :80

# Kill process if needed
sudo kill -9 PID
```

---

## 💰 Cost Estimation

| Resource | Monthly Cost (approx) |
|----------|----------------------|
| EC2 t3.small | $15-20 |
| Data Transfer | $5-10 |
| Domain | $10-15/year |
| **Total** | **~$25-35/month** |

---

## ✅ Deployment Checklist

- [ ] EC2 instance launched
- [ ] Security group configured (ports 22, 80, 443)
- [ ] DNS records added (A records for @ and www)
- [ ] Docker & Docker Compose installed
- [ ] Application deployed
- [ ] SSL certificate obtained
- [ ] HTTPS working
- [ ] Auto-renewal configured
- [ ] All pages accessible

---

**🎉 Congratulations! Your site is now live at https://www.mydatainterview.in**
