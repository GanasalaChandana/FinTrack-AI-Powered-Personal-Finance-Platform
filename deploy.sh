#!/bin/bash

# FinTrack Deployment Script
# Deploys both frontend and backend services

set -e

echo "╔════════════════════════════════════════╗"
echo "║   🚀 FinTrack Deployment Script 🚀    ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
check_prerequisites() {
  echo -e "${BLUE}Checking prerequisites...${NC}"
  
  if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    exit 1
  fi
  
  if ! command -v mvn &> /dev/null; then
    echo "❌ Maven is not installed"
    exit 1
  fi
  
  if ! command -v docker &> /dev/null; then
    echo "⚠️  Docker is not installed (optional for containerized deployment)"
  fi
  
  echo -e "${GREEN}✓ Prerequisites check passed${NC}"
  echo ""
}

# Build frontend
build_frontend() {
  echo -e "${BLUE}📦 Building Frontend...${NC}"
  cd frontend/web
  npm install
  npm run build
  cd ../../
  echo -e "${GREEN}✓ Frontend build complete${NC}"
  echo ""
}

# Build backend
build_backend() {
  echo -e "${BLUE}📦 Building Backend Services...${NC}"
  
  services=("api-gateway" "budgets-service" "transactions-service" "reports-service" "alerts-service")
  
  for service in "${services[@]}"; do
    echo "  Building $service..."
    cd backend/$service
    mvn clean package -DskipTests -q
    cd ../../
  done
  
  echo -e "${GREEN}✓ Backend build complete${NC}"
  echo ""
}

# Deploy with Docker
deploy_docker() {
  echo -e "${BLUE}🐳 Starting Docker containers...${NC}"
  
  if [ -f ".env.production" ]; then
    docker-compose --env-file .env.production up -d
  else
    echo "⚠️  .env.production not found, using default values"
    docker-compose up -d
  fi
  
  echo -e "${GREEN}✓ Docker deployment complete${NC}"
  echo ""
}

# Verify deployment
verify_deployment() {
  echo -e "${BLUE}✅ Verifying deployment...${NC}"
  sleep 5
  
  echo "  Checking API Gateway health..."
  if curl -f http://localhost:8080/actuator/health &> /dev/null; then
    echo -e "    ${GREEN}✓ API Gateway is healthy${NC}"
  else
    echo -e "    ${YELLOW}⚠️  API Gateway not responding (still starting)${NC}"
  fi
  
  echo "  Checking Budgets Service..."
  if curl -f http://localhost:8085/actuator/health &> /dev/null; then
    echo -e "    ${GREEN}✓ Budgets Service is healthy${NC}"
  else
    echo -e "    ${YELLOW}⚠️  Budgets Service not responding${NC}"
  fi
  
  echo ""
}

# Show deployment info
show_deployment_info() {
  echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║   ✅ Deployment Complete! ✅           ║${NC}"
  echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
  echo ""
  echo "📍 Service URLs:"
  echo "   Frontend:      http://localhost:3000"
  echo "   API Gateway:   http://localhost:8080"
  echo "   Budgets:       http://localhost:8085"
  echo "   Transactions:  http://localhost:8082"
  echo "   Reports:       http://localhost:8084"
  echo "   Alerts:        http://localhost:8083"
  echo ""
  echo "📚 Documentation: See DEPLOYMENT_GUIDE.md"
  echo ""
  echo "🔍 View logs:"
  echo "   docker-compose logs -f [service-name]"
  echo ""
  echo "🛑 Stop services:"
  echo "   docker-compose down"
  echo ""
}

# Main execution
main() {
  check_prerequisites
  
  read -p "Build frontend? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    build_frontend
  fi
  
  read -p "Build backend? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    build_backend
  fi
  
  read -p "Deploy with Docker Compose? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    deploy_docker
    verify_deployment
  fi
  
  show_deployment_info
}

# Run main
main
