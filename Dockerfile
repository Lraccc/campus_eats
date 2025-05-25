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
RUN npm run web-build || (echo "Web build failed" && exit 1)

# Production image
FROM nginx:alpine

# Copy built files to nginx
COPY --from=build /app/web-build /usr/share/nginx/html

# Copy serve.json for SPA routing
COPY --from=build /app/serve.json /usr/share/nginx/html

# Copy custom nginx config
RUN echo 'server {\n\
    listen 80;\n\
    location / {\n\
        root /usr/share/nginx/html;\n\
        index index.html index.htm;\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
