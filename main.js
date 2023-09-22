'use strict';

const {
  WebSocketServer
} = require("ws");
const https = require("https");
const fs = require("fs");
const path = require("path");
const express = require("express");
const session = require("express-session");
const FileStore = require('session-file-store')(session)

const {
  Card,
  PlayerCustomHand,
  PlayerCustomHandItem,
  PlayingCards,
  Player,
  GameStateMachine,
  PreGameLobby,
  Game
} = require("./types.js");
const {
  LANDING_PAGE_EVENTS,
  LANDING_PAGE_EVENT_REQS,
  LOBBY_EVENTS,
  LOBBY_EVENT_REQS,
  GAME_EVENTS
} = require("./events.js");
const { type } = require("os");

var SERVER_KEY_PATH = "./server.key";
var SERVER_CERT_PATH = "./server.cert";
var LOBBY_PASSWORD = "lobby_password";
var SESSION_COOKIE_SECRET = "session_cookie_secret";
var SESSION_STORE_PATH = "./sessions";
var SESSION_STORE_SECRET = "session_store_secret";

/**
 * @param {Express} app
 * @returns {https.Server}
 */
function createHTTPSServer(app) {
  const options = {
    key: fs.readFileSync(SERVER_KEY_PATH),
    cert: fs.readFileSync(SERVER_CERT_PATH),
  };
  return https.createServer(options, app);
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

  wss.on('connection', function connection(/** @type{WebSocket} */ ws, request, client) {
    ws.on('error', console.error);
    ws.on('message', function message(data) {
      console.log(`Received message ${data} from user ${client}`);
    });
    ws.send("What up dude!");
  });

  return wss;
}

function expressSetup(sessionRouter) {
  const app = express();
  app.use(express.static("public"));
  // app.use(sessionRouter);
  return app;
}

function authenticate() {
  return true;
}

function main() {
  let sessionRouter = session({
    cookie: { maxAge: 86400000 },
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
  });
  const app = expressSetup(sessionRouter);
  const httpsServer = createHTTPSServer(app);
  const wss = createWSServer(httpsServer, sessionRouter);

  httpsServer.listen(8080);
}

main();
