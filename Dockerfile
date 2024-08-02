FROM node:22

WORKDIR /

COPY package*.json ./

RUN yarn

COPY ./src .

EXPOSE 3000

CMD ["npm", "start"]
