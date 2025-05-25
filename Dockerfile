# This is a wrapper Dockerfile that points to the mobile Dockerfile
FROM node:18-alpine AS build

WORKDIR /app

# Copy package files first for better caching
COPY mobile/package*.json ./

# Install dependencies with legacy peer deps flag to avoid issues
RUN npm install --legacy-peer-deps

# Copy the rest of the mobile directory
COPY mobile/ ./

# Build the web version with explicit environment variables
ENV NODE_ENV=production
# Use the correct expo export command
RUN npx expo export --platform web || (echo "Web build failed" && exit 1)

# Production image
FROM nginx:alpine

# Copy built files to nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Copy serve.json for SPA routing
COPY --from=build /app/serve.json /usr/share/nginx/html

# Copy custom nginx config
RUN echo 'server {
    listen 80;
    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
    }
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
