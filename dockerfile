FROM node:16-alpine 
WORKDIR /databucket
COPY . .
RUN npm install
RUN npm install pm2 -g
CMD ["pm2-runtime","databucket.js"]
