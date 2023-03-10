#!/bin/bash

cp /etc/letsencrypt/live/api.swordswithfriends.org/* ./creds/
docker-compose build
docker-compose up -d