FROM node:24.19.0-alpine3.24

WORKDIR /app

RUN npm install --global npm@11.9.0 --no-audit --no-fund

COPY package.json package-lock.json ./

RUN npm ci --include=dev --no-audit --no-fund

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev"]
