FROM node:24-slim
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages ./packages
COPY services ./services
RUN npm ci
EXPOSE 8081
CMD ["npm","--workspace","services/runtime","run","dev"]

