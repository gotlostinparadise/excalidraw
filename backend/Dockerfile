FROM node:18
WORKDIR /opt/backend
COPY package.json yarn.lock* ./
RUN yarn install --production
COPY index.js ./
EXPOSE 5000
CMD ["node", "index.js"]
