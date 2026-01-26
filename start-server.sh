#!/bin/bash
# Simple script to start the local HTTP server

cd "$(dirname "$0")"

echo "Starting Game Hub server..."
python3 server.py
