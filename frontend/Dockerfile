FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* bun.lockb* ./

# Install dependencies
RUN if [ -f bun.lockb ]; then \
        npm install -g bun && bun install; \
    elif [ -f package-lock.json ]; then \
        npm ci; \
    else \
        npm install; \
    fi

# Copy the rest of the application
COPY . .

# Make sure environment variables are properly set for build time
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Build the application
RUN if [ -f bun.lockb ]; then \
        bun run build; \
    else \
        npm run build; \
    fi

# Expose the port Next.js runs on
EXPOSE 3000

# Start the application
CMD if [ -f bun.lockb ]; then \
        bun run start; \
    else \
        npm run start; \
    fi