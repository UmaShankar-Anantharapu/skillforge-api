#!/bin/bash

ENV=$1

if [ -z "$ENV" ]; then
  echo "Usage: $0 <development|production>"
  exit 1
fi

if [ "$ENV" = "development" ]; then
  echo "Setting up development environment for API..."
  export NODE_ENV=development
  # For local development, you might just run `npm install` and `npm run dev`
  echo "To start development server, run: npm install && npm run dev"
elif [ "$ENV" = "production" ]; then
  echo "Setting up production environment for API..."
  export NODE_ENV=production
  echo "Installing dependencies..."
  npm install --production
  echo "Building/Starting production server..."
  # In a real production environment, you would use a process manager like PM2 or systemd
  # For this example, we'll just start the server directly
  echo "To start production server, run: npm start"
else
  echo "Invalid environment: $ENV"
  exit 1
fi

echo "API deployment script finished."