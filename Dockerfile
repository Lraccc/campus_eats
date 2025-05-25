# This is a wrapper Dockerfile that points to the mobile Dockerfile
FROM node:18-alpine AS build

WORKDIR /app

# Copy the mobile directory
COPY mobile/ ./

# Install dependencies
RUN npm install

# Build the web version
RUN npm run web-build

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
