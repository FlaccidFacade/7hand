# Build stage
# FROM node:20-alpine as build
# WORKDIR /app
# COPY package*.json ./
# RUN npm install -g @angular/cli && npm install
# COPY . .
# RUN npm run build -- --configuration production

# Development stage
FROM node:20-slim as dev
WORKDIR /workspace
COPY --from=build /app/node_modules /workspace/node_modules
RUN npm install -g @angular/cli
EXPOSE 4200
CMD ["npm", "start"]

# Production stage
FROM nginx:1.27-alpine as prod
COPY --from=build /app/dist/card-game-frontend/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
