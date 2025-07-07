#!/bin/bash

# Keep Mac awake and run appointment checker
# This script prevents sleep and keeps the script running

echo "🔋 Keeping Mac awake and running appointment checker..."
echo "   - Computer will not sleep while this runs"
echo "   - Close this terminal to stop"
echo "   - Press Ctrl+C to stop"

# Use caffeinate to prevent sleep and run the checker
caffeinate -i ./start-checker.sh