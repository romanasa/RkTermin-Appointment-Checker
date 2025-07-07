#!/bin/bash

# German Embassy Appointment Checker Startup Script
# This script ensures the appointment checker runs with correct environment

# Change to the correct directory
cd "/Users/roman/prog/scripts/visa/RkTermin-Appointment-Checker"

# Set up Node.js environment - use full paths for cron
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
export NODE_PATH="/opt/homebrew/lib/node_modules"

# Log startup attempt
echo "$(date): Starting appointment checker..." >> /tmp/appointment-checker.log
echo "PATH: $PATH" >> /tmp/appointment-checker.log
echo "Working directory: $(pwd)" >> /tmp/appointment-checker.log

# Start the appointment checker with full path
/opt/homebrew/bin/npx ts-node src/index.ts >> /tmp/appointment-checker.log 2>&1 &

# Get the process ID
PID=$!
echo "$(date): Appointment checker started with PID: $PID" >> /tmp/appointment-checker.log