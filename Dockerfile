FROM node:20-alpine

WORKDIR /app

# 零依赖，无需 npm install；仅复制源码与内容
COPY server ./server
COPY public ./public
COPY data ./data
COPY docs ./docs
COPY tests ./tests
COPY tools ./tools
COPY README.md ./README.md

ENV HOST=0.0.0.0
ENV PORT=8090

EXPOSE 8090

CMD ["node", "server/server.js"]
