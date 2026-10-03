# Frontend Dockerfile - Multi-stage build
# Stage 1: Build
FROM node:20-alpine as builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including dev dependencies needed for the build)
RUN npm ci

# Copy source code
COPY . .

# Build arguments: Vite inlines these into the bundle at build time.
#   VITE_API_URL  - Flask backend          (reverse proxy path /api)
#   VITE_LPR_URL  - SentraAI HTTP API      (reverse proxy path /ai)
#   VITE_WS_URL   - SentraAI WebSocket     (use an absolute wss:// URL in production)
#   VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY - public values for Google OAuth
ARG VITE_API_URL=/api
ARG VITE_LPR_URL=/ai
ARG VITE_WS_URL=/ws
ARG VITE_SUPABASE_URL=
ARG VITE_SUPABASE_ANON_KEY=

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_LPR_URL=$VITE_LPR_URL
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

# Build the application
RUN npm run build

# Stage 2: Production with Nginx
FROM nginx:alpine as production

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:80/ || exit 1

# Expose port
EXPOSE 80

# Run nginx
CMD ["nginx", "-g", "daemon off;"]
