FROM node:24-slim
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages ./packages
COPY services ./services
RUN npm ci
EXPOSE 8082
CMD ["npm","--workspace","services/registry","run","dev"]

