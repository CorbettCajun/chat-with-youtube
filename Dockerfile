# Build stage
FROM node:18-alpine AS builder

# Install system dependencies for audio processing
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    py3-pip \
    gcc \
    musl-dev \
    python3-dev \
    linux-headers

WORKDIR /app

# Create and activate Python virtual environment
ENV VIRTUAL_ENV=/app/venv
RUN python3 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Install Python dependencies in virtual environment
COPY requirements.txt ./
RUN . $VIRTUAL_ENV/bin/activate && pip3 install --no-cache-dir -r requirements.txt && \
    pip3 install --no-cache-dir --no-deps openai-whisper==20231117

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application
COPY . .

# Set build-time environment variables (these are only used during build)
ARG OPENAI_API_KEY
ARG PINECONE_API_KEY
ARG PINECONE_INDEX
ARG PINECONE_ENVIRONMENT
ARG YOUTUBE_API_KEY

ENV OPENAI_API_KEY=$OPENAI_API_KEY
ENV PINECONE_API_KEY=$PINECONE_API_KEY
ENV PINECONE_INDEX=$PINECONE_INDEX
ENV PINECONE_ENVIRONMENT=$PINECONE_ENVIRONMENT
ENV YOUTUBE_API_KEY=$YOUTUBE_API_KEY
ENV NEXT_TELEMETRY_DISABLED=1

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS runner

# Install system dependencies for audio processing
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    py3-pip \
    gcc \
    musl-dev \
    python3-dev \
    linux-headers

WORKDIR /app

# Create and activate Python virtual environment
ENV VIRTUAL_ENV=/app/venv
RUN python3 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Install Python dependencies in virtual environment
COPY --from=builder /app/requirements.txt ./
RUN . $VIRTUAL_ENV/bin/activate && pip3 install --no-cache-dir -r requirements.txt && \
    pip3 install --no-cache-dir --no-deps openai-whisper==20231117

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built application from builder stage
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/src ./src

# Set runtime environment variables
ENV NODE_ENV=production
ENV OPENAI_API_KEY=$OPENAI_API_KEY
ENV PINECONE_API_KEY=$PINECONE_API_KEY
ENV PINECONE_INDEX=$PINECONE_INDEX
ENV PINECONE_ENVIRONMENT=$PINECONE_ENVIRONMENT
ENV YOUTUBE_API_KEY=$YOUTUBE_API_KEY
ENV NEXT_TELEMETRY_DISABLED=1

# Create directories for temporary files and caching
RUN mkdir -p /app/temp/audio /app/temp/cache
VOLUME ["/app/temp/audio", "/app/temp/cache"]

# Add a non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001
RUN chown -R nextjs:nodejs /app
USER nextjs

# Expose the application port
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start the application
CMD ["npm", "start"]
