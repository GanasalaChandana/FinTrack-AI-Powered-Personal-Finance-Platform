# FinTrack Deployment Guide

## 📋 Table of Contents
1. [System Requirements](#system-requirements)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Deployment Steps](#deployment-steps)
4. [Post-Deployment Verification](#post-deployment-verification)
5. [Troubleshooting](#troubleshooting)
6. [Production Configuration](#production-configuration)

---

## System Requirements

### Hardware
- **CPU**: Dual-core processor or better
- **Memory**: 8GB RAM minimum (16GB recommended)
- **Storage**: 50GB free disk space
- **Network**: Stable internet connection

### Software Stack
- **OS**: Linux (Ubuntu 20.04+), macOS, or Windows Server 2019+
- **Node.js**: 18.x or higher
- **Java**: OpenJDK 11 or later
- **Maven**: 3.8.0 or later
- **Git**: 2.34+
- **Docker**: 20.10+ (optional, for containerization)

### Database
- **PostgreSQL**: 12.x or higher (for persistent data)
- **Redis**: 6.x+ (optional, for caching)

---

## Pre-Deployment Checklist

- [ ] All tests passing locally
- [ ] Code merged to main branch
- [ ] Environment variables configured
- [ ] Database migrations verified
- [ ] SSL certificates obtained (for production)
- [ ] Backup strategy in place
- [ ] Monitoring and logging configured
- [ ] Team notified of deployment

---

## Deployment Steps

### Step 1: Frontend Deployment

```bash
# Navigate to frontend directory
cd frontend/web

# Install dependencies
npm install

# Build for production
npm run build

# Output: Next.js optimized build in .next/ directory
```

**Deployment Options:**
- **Vercel**: `vercel deploy`
- **AWS Amplify**: Push to GitHub → auto-deploy
- **Self-hosted**: Serve with `npm start` or with nginx

### Step 2: Backend Services Deployment

```bash
# Build all backend services
for service in api-gateway budgets-service transactions-service reports-service alerts-service; do
  cd backend/$service
  mvn clean package -DskipTests
  # Output: JAR in target/ directory
  cd ../../
done
```

**Service Deployment:**

#### API Gateway (Port 8080)
```bash
cd backend/api-gateway
java -jar target/api-gateway-*.jar \
  --spring.profiles.active=production \
  --server.port=8080
```

#### Budgets Service (Port 8085)
```bash
cd backend/budgets-service
java -jar target/budgets-service-*.jar \
  --spring.profiles.active=production \
  --server.port=8085
```

#### Transactions Service (Port 8082)
```bash
cd backend/transactions-service
java -jar target/transactions-service-*.jar \
  --spring.profiles.active=production \
  --server.port=8082
```

#### Reports Service (Port 8084)
```bash
cd backend/reports-service
java -jar target/reports-service-*.jar \
  --spring.profiles.active=production \
  --server.port=8084
```

#### Alerts Service (Port 8083)
```bash
cd backend/alerts-service
java -jar target/alerts-service-*.jar \
  --spring.profiles.active=production \
  --server.port=8083
```

### Step 3: Environment Configuration

Create `.env.production` in the frontend directory:
```bash
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_AUTH_PROVIDER=google
NODE_ENV=production
```

Create `application-production.yml` in each backend service:
```yaml
spring:
  datasource:
    url: jdbc:postgresql://your-postgres-host:5432/fintrack
    username: ${DB_USER}
    password: ${DB_PASSWORD}
  jpa:
    hibernate:
      ddl-auto: validate

jwt:
  secret: ${JWT_SECRET}
  expiration: 86400000

server:
  port: ${SERVICE_PORT}
```

### Step 4: Database Setup

```bash
# Create database
createdb fintrack

# Run migrations
# (Note: Migrations run automatically with spring.jpa.hibernate.ddl-auto=update)
```

### Step 5: Start Services

**Using Docker Compose:**
```bash
docker-compose up -d
```

**Using systemd (Linux):**
```bash
# Copy JAR files to /opt/fintrack/
# Create systemd service files
# Start services
systemctl start fintrack-api-gateway
systemctl start fintrack-budgets
systemctl start fintrack-transactions
systemctl start fintrack-reports
systemctl start fintrack-alerts
```

---

## Post-Deployment Verification

### Health Checks

```bash
# API Gateway health
curl http://localhost:8080/actuator/health

# Verify all endpoints
curl http://localhost:8080/api/goals \
  -H "Authorization: Bearer YOUR_TOKEN"
curl http://localhost:8080/api/budgets \
  -H "Authorization: Bearer YOUR_TOKEN"
curl http://localhost:8080/api/transactions \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Frontend Verification

1. Navigate to application URL
2. Verify login page loads
3. Login with test account
4. Check all pages load correctly:
   - Dashboard
   - Transactions
   - Goals & Budgets
   - Reports
   - Alerts
   - Notifications

### Performance Monitoring

```bash
# Monitor service logs
journalctl -u fintrack-api-gateway -f

# Check memory/CPU usage
top -p $(pgrep -f "api-gateway")

# Database connection pool
# Monitor in application logs
```

---

## Troubleshooting

### Common Issues

#### 1. Database Connection Failed
```
Error: Connection to PostgreSQL failed
Solution: 
  - Check DB_USER, DB_PASSWORD, database URL
  - Verify PostgreSQL is running
  - Check firewall rules
```

#### 2. Port Already in Use
```
Error: Address already in use: :::8080
Solution:
  - Kill existing process: lsof -i :8080 | grep LISTEN | awk '{print $2}' | xargs kill -9
  - Or use different port: --server.port=8081
```

#### 3. JWT Token Invalid
```
Error: Unauthorized (401)
Solution:
  - Verify JWT_SECRET matches across services
  - Check token expiration
  - Re-authenticate
```

#### 4. CORS Errors
```
Error: Cross-Origin Request Blocked
Solution:
  - Update CORS configuration in API Gateway
  - Add frontend URL to allowedOrigins in application.yml
  - Restart services
```

---

## Production Configuration

### Security

1. **SSL/TLS**
   ```yaml
   server:
     ssl:
       key-store: /etc/fintrack/keystore.p12
       key-store-password: ${SSL_KEYSTORE_PASSWORD}
   ```

2. **API Keys & Secrets**
   - Store in environment variables only
   - Use AWS Secrets Manager or HashiCorp Vault
   - Rotate regularly

3. **Database**
   - Use strong passwords
   - Enable SSL for DB connections
   - Regular backups

### Performance

1. **Caching**
   ```yaml
   spring:
     cache:
       type: redis
       redis:
         host: redis-host
         port: 6379
   ```

2. **Rate Limiting**
   - Configure in API Gateway
   - Implement per-user rate limits

3. **Load Balancing**
   - Use nginx or HAProxy
   - Distribute across multiple instances

### Monitoring

```bash
# Application Insights (Azure)
# Datadog
# New Relic
# Prometheus + Grafana
```

### Backup Strategy

```bash
# Daily database backups
0 2 * * * pg_dump fintrack | gzip > /backup/fintrack-$(date +\%Y\%m\%d).sql.gz

# Backup retention: 30 days
find /backup -name "fintrack-*.sql.gz" -mtime +30 -delete
```

---

## Quick Start Deployment Script

```bash
#!/bin/bash
set -e

echo "🚀 Starting FinTrack Deployment..."

# Build frontend
echo "📦 Building frontend..."
cd frontend/web
npm install
npm run build
cd ../../

# Build backend
echo "📦 Building backend services..."
for service in api-gateway budgets-service transactions-service reports-service alerts-service; do
  cd backend/$service
  mvn clean package -DskipTests
  cd ../../
done

# Start services
echo "🚀 Starting services..."
docker-compose up -d

# Verify
echo "✅ Verifying deployment..."
sleep 10
curl -f http://localhost:8080/actuator/health || exit 1

echo "🎉 Deployment complete!"
```

---

## Support

For issues or questions:
- Check logs: `journalctl -u fintrack-service-name -f`
- Review configuration files
- Contact development team
- Create GitHub issue

---

**Last Updated**: 2024-04-08  
**Version**: 1.0.0
