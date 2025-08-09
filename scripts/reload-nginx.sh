#!/bin/sh
# This script reloads nginx in the client container after cert renewal

docker exec client nginx -s reload
