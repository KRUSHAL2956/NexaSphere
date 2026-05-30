# Stage 1: Install dependencies
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Stage 2: Production runtime
FROM node:20-alpine AS production

# Set Node environment to production
ENV NODE_ENV=production

WORKDIR /usr/src/app

# Copy production dependencies from builder
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Copy application source code
COPY . .

# Expose the port the app runs on
EXPOSE 8787

# Start the server
CMD ["node", "index.js"]
