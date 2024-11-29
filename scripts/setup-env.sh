#!/bin/bash

# Function to check if a file exists
check_file() {
    if [ ! -f "$1" ]; then
        echo "Error: $1 does not exist"
        exit 1
    fi
}

# Function to set environment variables
set_env_vars() {
    export $(cat "$1" | grep -v '^#' | xargs)
}

# Check if environment argument is provided
if [ "$1" == "prod" ]; then
    ENV_FILE=".env.production"
elif [ "$1" == "dev" ]; then
    ENV_FILE=".env.local"
else
    echo "Usage: ./setup-env.sh [prod|dev]"
    exit 1
fi

# Check if the environment file exists
check_file "$ENV_FILE"

# Set environment variables
set_env_vars "$ENV_FILE"

echo "Environment variables loaded from $ENV_FILE"

# Run the docker compose command with the specified environment
if [ "$1" == "prod" ]; then
    docker compose up --build -d
else
    docker compose -f docker-compose.dev.yml up --build -d
fi
