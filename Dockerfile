FROM node:24-bookworm-slim
WORKDIR /app
COPY --chown=node:node package.json server.mjs ./
COPY --chown=node:node src ./src
COPY --chown=node:node public ./public
RUN mkdir -p /data && chown node:node /data
USER node
ENV NODE_ENV=production DATA_DIR=/data HOST=0.0.0.0 PORT=8080
VOLUME ["/data"]
EXPOSE 8080
CMD ["node", "server.mjs"]
