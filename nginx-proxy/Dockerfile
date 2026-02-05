FROM nginx:1.27-alpine

# Remove default nginx configuration
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom 7hand game proxy configuration
COPY sevenhand.conf /etc/nginx/conf.d/sevenhand.conf

# Create custom log directory for 7hand application
RUN mkdir -p /var/log/nginx && \
    touch /var/log/nginx/sevenhand_access.log && \
    touch /var/log/nginx/sevenhand_error.log

EXPOSE 8000

CMD ["nginx", "-g", "daemon off;"]
