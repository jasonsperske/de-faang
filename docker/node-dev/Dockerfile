# Runtime for debugging questions: Node 22 with the projects' npm dependencies preinstalled in
# /node_modules, so a project mounted at /app resolves them without an install (or a network).
# Built locally by de-faang on first use: docker build -t defaang-node-dev:1 docker/node-dev
FROM node:22-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends sqlite3 curl procps \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /
COPY package.json /package.json
RUN npm install --no-audit --no-fund && npm cache clean --force \
 && chmod -R a+rX /node_modules
WORKDIR /app
EXPOSE 5173
CMD ["npm", "run", "dev"]
