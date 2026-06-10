#!/bin/bash
echo "Stopping Impact"
pkill -f /home/niall/projects/Impact/index.js
pm2 delete all
echo "All stopped."