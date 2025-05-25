FROM node:18-alpine AS build

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the app
COPY . .

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
