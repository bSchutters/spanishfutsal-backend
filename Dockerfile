FROM node:18

WORKDIR /app

COPY . .

RUN npm install -g pnpm@7 && pnpm install

RUN pnpm build

EXPOSE 1337

CMD ["pnpm", "start"]