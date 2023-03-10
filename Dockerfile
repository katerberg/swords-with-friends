FROM node:16

WORKDIR /
RUN apt-get update
RUN apt-get install wait-for-it
COPY package.json .
RUN npm install
COPY . .
CMD npm run start:stable-server
