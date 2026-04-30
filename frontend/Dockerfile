# ── Stage 1: Build the React app ──────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copy only package files first for better layer caching
COPY package*.json ./

# Use npm install (not npm ci) to avoid lockfile version mismatches
RUN npm install --legacy-peer-deps

# Copy the rest of the source
COPY . .

# Prevent treating warnings as errors during CRA build
ENV CI=false

# Build production bundle
RUN npm run build

# ── Stage 2: Serve with nginx ──────────────────────────────────────────────────
FROM nginx:stable-alpine

# Copy the build output
COPY --from=builder /app/build /usr/share/nginx/html

# SPA routing: redirect all routes to index.html
RUN printf 'server {\n\
    listen 80;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
