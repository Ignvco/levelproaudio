# ── Imagen base Node ───────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Copia dependencias primero (cache de Docker)
COPY package*.json ./
RUN npm install

# Copia el resto del código
COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]