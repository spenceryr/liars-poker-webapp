FROM node:18-alpine3.18 as build

WORKDIR /src/app

COPY package*.json .
RUN npm install

COPY client/package*.json ./client/
RUN cd client && npm install

COPY . .
RUN npm run build-client && npm run get-client

FROM node:18-alpine3.18 as prod

WORKDIR /src/app

COPY --from=build /src/app/package.json .
COPY --from=build /src/app/package-lock.json .
RUN npm install --omit=dev

COPY --from=build /src/app/src ./src
COPY --from=build /src/app/views ./views
COPY --from=build /src/app/public ./public
COPY --from=build /src/app/main.js .
COPY --from=build /src/app/.env.vault .

# Add Tini (basic init)
RUN apk add --no-cache tini
# Tini is now available at /sbin/tini
ENTRYPOINT ["/sbin/tini", "--"]

CMD [ "node", "main.js" ]
