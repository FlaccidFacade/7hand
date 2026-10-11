# Build stage
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json .npmrc ./
RUN npm install -g @angular/cli && npm install
COPY . .
RUN npm run build -- --configuration production

# Development stage
FROM node:24-slim AS dev
WORKDIR /workspace
COPY package*.json .npmrc ./
RUN npm install -g @angular/cli && npm install
EXPOSE 4200
CMD ["npm", "start"]

# Production stage
FROM nginx:1.27-alpine AS prod
COPY --from=build /app/dist/card-game-frontend/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
