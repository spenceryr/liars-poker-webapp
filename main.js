'use strict';

import { WebSocketServer } from "ws";
import { createServer } from "node:https";
import { readFileSync } from "node:fs";
import express from "express";
import session from "express-session";
import { default as _FileStore } from "session-file-store";
const FileStore = _FileStore(session)
import { rateLimit } from "express-rate-limit";
import bcrypt from "bcrypt"
import "dotenv/config"
import path from "node:path";
import assert from "node:assert";
import { randomUUID } from "node:crypto";

/** @type {string} */
var SERVER_KEY_PATH = process.env.SERVER_KEY_PATH;
assert(SERVER_KEY_PATH);
/** @type {string} */
var SERVER_CERT_PATH = process.env.SERVER_CERT_PATH;
assert(SERVER_CERT_PATH);
/** @type {string} */
var LOBBY_PASSWORD = process.env.LOBBY_PASSWORD;
assert(LOBBY_PASSWORD);
/** @type {string} */
var SESSION_COOKIE_SECRET = process.env.SESSION_COOKIE_SECRET;
assert(SESSION_COOKIE_SECRET);
/** @type {string} */
var SESSION_STORE_PATH = process.env.SESSION_STORE_PATH;
assert(SESSION_STORE_PATH);
/** @type {string} */
var SESSION_STORE_SECRET = process.env.SESSION_STORE_SECRET;
assert(SESSION_STORE_SECRET);


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
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy;
        return;
      }

      wss.handleUpgrade(request, socket, head, function done(ws) {
        wss.emit('connection', ws, request, client);
      });
    });
  });

  wss.on('connection', function connection(/** @type{WebSocket} */ ws, request, clientID) {
    console.log("CONNECTED");
    ws.on('error', console.error.bind("ERROR"));
    ws.on('message', function message(data) {
      console.log("MESSAGE");
    });
    ws.on("open", () => {
      console.log("OPENED2");
    });
  });

  return wss;
}

/**
 *
 * @param {express.RequestHandler} sessionRouter
 * @returns
 */
function expressSetup(sessionRouter) {
  const app = express();
  app.disable("x-powered-by");
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    standardHeaders: 'draft-7', // Set `RateLimit` and `RateLimit-Policy` headers
  }));
  app.use(sessionRouter);
  app.use(express.urlencoded({extended: "false"}));
  app.use(express.json());
  // TODO: (spencer) Multi-lobby support by including the lobby code in the request.
  app.post("/joinlobby", async function verifyJoinLobby(req, res) {
    if (req.session.clientID) {
      res.redirect("/");
      return;
    }
    if (typeof req.lobbyPassword !== "string") {
      res.sendStatus(401);
      return;
    }
    try {
      let valid = await bcrypt.compare(req.lobbyPassword, LOBBY_PASSWORD);
      if (!valid) throw Error();
    } catch (_) {
      res.sendStatus(401);
      return;
    }
    req.session.clientID = randomUUID();
    res.sendStatus(200);
  });
  let staticOptions = {
    redirect: false,
    dotfiles: "deny"
  };
  app.get("/", function isValidated(req, res, next) {
    if (authenticate(req)) {
      return next("route");
    }
  } , express.static(path.join(__dirname, "public"), staticOptions));
  app.use("/",
    function validateRequest (req, res, next) {
      if (!req.session.clientID) {
        res.sendStatus(403);
        return;
      }
    },
    express.static(path.join(__dirname, "public", "authenticated"), staticOptions)
  );
  return app;
}

/**
 *
 * @param {express.Request} req
 * @returns
 */
function authenticate(req) {
  if (req.session.clientID) return true;
  return false;
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
