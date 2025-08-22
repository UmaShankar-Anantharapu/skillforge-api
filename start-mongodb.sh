#!/bin/bash

# MongoDB Management Script for SkillForge

MONGO_DATA_DIR="$HOME/mongodb/data"
MONGO_LOG_DIR="$HOME/mongodb/logs"
MONGO_LOG_FILE="$MONGO_LOG_DIR/mongo.log"

# Create directories if they don't exist
mkdir -p "$MONGO_DATA_DIR" "$MONGO_LOG_DIR"

echo "Starting MongoDB..."
echo "Data directory: $MONGO_DATA_DIR"
echo "Log file: $MONGO_LOG_FILE"

# Check if MongoDB is already running
if pgrep -x "mongod" > /dev/null; then
    echo "MongoDB is already running!"
    echo "Process ID: $(pgrep -x mongod)"
    echo "Port: 27017"
else
    # Start MongoDB
    mongod --dbpath "$MONGO_DATA_DIR" --logpath "$MONGO_LOG_FILE" --fork
    
    if [ $? -eq 0 ]; then
        echo "MongoDB started successfully!"
        echo "Process ID: $(pgrep -x mongod)"
        echo "Port: 27017"
        echo ""
        echo "You can now connect with MongoDB Compass using:"
        echo "Connection string: mongodb://localhost:27017"
    else
        echo "Failed to start MongoDB!"
        exit 1
    fi
fi

echo ""
echo "To stop MongoDB, run: pkill mongod"
echo "To view logs, run: tail -f $MONGO_LOG_FILE"

