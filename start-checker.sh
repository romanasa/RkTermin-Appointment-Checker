#!/bin/bash

# German Embassy Appointment Checker Startup Script
# This script ensures the appointment checker runs with correct environment

# Change to the correct directory
cd "/Users/erikashefer/Prog/RkTermin-Appointment-Checker"

# Set up Bun environment - use full paths for cron
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

# Log startup attempt
echo "$(date): Starting appointment checker..." >> /tmp/appointment-checker.log
echo "PATH: $PATH" >> /tmp/appointment-checker.log
echo "Working directory: $(pwd)" >> /tmp/appointment-checker.log

# Start the appointment checker with Bun
$HOME/.bun/bin/bun src/index.ts >> /tmp/appointment-checker.log 2>&1 &

# Get the process ID
PID=$!
echo "$(date): Appointment checker started with PID: $PID" >> /tmp/appointment-checker.log