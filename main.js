'use strict';

import { WebSocketServer } from "ws";
import { createServer } from "https";
import { readFileSync } from "fs";
import express from "express";
import session from "express-session";
const FileStore = require('session-file-store')(session)
import { rateLimit } from 'express-rate-limit';

var SERVER_KEY_PATH = "./server.key";
var SERVER_CERT_PATH = "./server.cert";
var LOBBY_PASSWORD = "lobby_password";
var SESSION_COOKIE_SECRET = "session_cookie_secret";
var SESSION_STORE_PATH = "./sessions";
var SESSION_STORE_SECRET = "session_store_secret";


/**
 * @type {Map<ClientID, ClientData>}
 */
var connections = {};

/**
 * @param {Express} app
 * @returns {https.Server}
 */
function createHTTPSServer(app) {
  const options = {
    key: readFileSync(SERVER_KEY_PATH),
    cert: readFileSync(SERVER_CERT_PATH),
  };
  return createServer(options, app);
}

/**
 *
 * @param {https.Server} httpsServer
 * @param {session} sessionRouter
 * @returns {WebSocketServer}
 */
function createWSServer(httpsServer, sessionRouter) {
  const wss = new WebSocketServer({ clientTracking: false, noServer: true });
  httpsServer.on('upgrade', function upgrade(request, socket, head) {
    sessionRouter(request, {}, () => {
      const client = authenticate(request);
      if (!client) {
        console.error("No client!");
        socket.destroy;
        return;
      }

      wss.handleUpgrade(request, socket, head, function done(ws) {
        wss.emit('connection', ws, request, client);
      });
    });
  });

  wss.on('connection', function connection(/** @type{WebSocket} */ ws, request, clientID) {
    connections[ws] = ConnectionData(clientID);
    ws.on('error', console.error);
    ws.on('message', function message(data) {
      let connectionData = connections.get(ws);
      if (connectionData === undefined) {
        ws.close();
        return;
      }
      if (!connectionData.leakyBucket.fill()) return;
      processMessage(data);
    });
  });

  return wss;
}

function expressSetup(sessionRouter) {
  const app = express();
  app.use(express.static("public"));
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    standardHeaders: 'draft-7', // Set `RateLimit` and `RateLimit-Policy` headers
  }));
  app.use(sessionRouter);
  return app;
}

function authenticate() {
  return true;
}

function main() {
  let sessionRouter = session({
    cookie: { path: '/', httpOnly: true, secure: false, sameSite: true, maxAge: 86400000 },
    saveUninitialized: false,
    store: new FileStore({
      path: SESSION_STORE_PATH,
      ttl: 86400,
      reapAsync: true,
      reapSyncFallback: true,
      secret: SESSION_STORE_SECRET
    }),
    resave: false,
    secret: SESSION_COOKIE_SECRET,
    name: "sessionID"
  });
  const app = expressSetup(sessionRouter);
  const httpsServer = createHTTPSServer(app);
  const wss = createWSServer(httpsServer, sessionRouter);

  httpsServer.listen(8080);
}

main();
