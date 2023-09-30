'use strict';

import https from "https"
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
import nunjucks from "nunjucks"
import { ClientData, ClientDataStore } from "./js/client-data.js";
import { Lobby, LobbyStore } from "./js/lobby.js";

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {string} */
var SERVER_KEY_PATH = process.env.SERVER_KEY_PATH;
assert(SERVER_KEY_PATH);
/** @type {string} */
var SERVER_CERT_PATH = process.env.SERVER_CERT_PATH;
assert(SERVER_CERT_PATH);
/** @type {string} */
var SITE_PASSWORD = process.env.SITE_PASSWORD;
assert(SITE_PASSWORD);
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
      const client = getClientFromReq(request);
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

  wss.on('connection',
    /**
     *
     * @param {WebSocket} ws
     * @param {import("http".IncomingMessage)} request
     * @param {ClientData} client
     */
    function connection(ws, request, client) {
      let result = client.connectedToWS(ws);
      assert(result);
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
  nunjucks.configure(path.join(__dirname, "views"), { autoescape: true, express: app });
  app.disable("x-powered-by");
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    standardHeaders: 'draft-7', // Set `RateLimit` and `RateLimit-Policy` headers
  }));
  app.use(sessionRouter);
  app.use(express.urlencoded({extended: "false"}));
  app.use(express.json(), (err, req, res, next) => { res.sendStatus(400) });

  app.use(function setClient(req, res, next) {
    if (req.session.liarsClientID) req.liarsClient = ClientDataStore.get(req.session.liarsClientID);
    next();
  });

  /**
   *
   * @param {string?} [redirect=/]
   * @returns {express.Router}
   */
  function authRequired(redirect = "/") {
    if (redirect) assert(typeof redirect === "string");
    if (redirect === "") redirect = "/";
    if (!redirect) redirect = null;
    return (req, res, next) => {
      if (req.liarsClient) next();
      else if (redirect) res.redirect(redirect);
      else res.sendStatus(401);
    }
  }
  /**
   *
   * @param {express.Router} successCB
   * @param {express.Router?} [failureCB=null]
   * @returns {express.Router}
   */
  function isAuthenticated(successCB, failureCB) {
    return (req, res, next) => {
      if (req.liarsClient) return successCB(req, res, next);
      else if (failureCB) return failureCB(req, res, next);
      else return next();
    };
  }

  /**
   *
   * @returns {express.Router}
   */
  function restoreClientSession() {
    return (req, res, next) => {
      assert(req.liarsClient);
      if (req.liarsClient.lobbyID) res.redirect(`/lobby/${req.liarsClient.lobbyID}`)
      else res.redirect("/lobby-list")
    };
  }

  /**
   *
   * @returns {express.ErrorRequestHandler}
   */
  function handleRenderError() {
    return (err, req, res, next) => {
      console.error(`Render error: ${err}`);
      res.sendStatus(500);
    };
  }

  app.use("/js",
    express.static(path.join(__dirname, "public", "js"), { redirect: false, index: false, dotfiles: "deny" })
  );

  app.use("/auth/js",
    authRequired(null),
    express.static(path.join(__dirname, "public", "auth", "js"), { redirect: false, index: false, dotfiles: "deny" })
  );

  app.get("/",
    isAuthenticated(restoreClientSession()),
    (req, res) => {
      res.render("index.njk");
    },
    handleRenderError()
  );

  app.post("/login",
    isAuthenticated(restoreClientSession()),
    async function verifyLogin(req, res) {
    let password = req.body.password;
    if (!password || typeof password !== "string") return res.sendStatus(400);
    try {
      let result = await bcrypt.compare(password, SITE_PASSWORD);
      if (!result) throw Error();
    } catch (_) {
      return res.status(200).json({ result: "incorrect" })
    }
    let clientID = randomUUID();
    let client = new ClientData(clientID);
    ClientDataStore.set(clientID, client);
    req.session.liarsClientID = clientID;
    res.redirect("/lobby-list");
  });

  let authRouter = express.Router();
  app.use(authRouter);
  authRouter.use(authRequired());

  authRouter.get("/lobby-list",
    function serveLobbiesList(req, res, next) {
      res.render("lobby-list.njk", { lobbies: Array.from(LobbyStore.entries()) });
    },
    handleRenderError()
  );

  // TODO: (spencer) Use connect-ensure-login once multiple lobbies are supported.
  authRouter.get("/lobby/:lobbyID",
    function goToLobby(req, res, next) {
      let lobbyID = req.params.lobbyID;
      // TODO: (spencer) Currently always joins same lobby. Add multi-lobby support.
      if (LobbyStore.size <= 0) LobbyStore.set(0, new Lobby(0, null));
      if (!req.liarsClient.joinLobby(0 /* lobbyID */)) return res.redirect("/lobby-list");
      res.render("lobby.njk", { lobby: client.lobby });
    },
    handleRenderError()
  );
  return app;
}

/**
 *
 * @param {import("http".IncomingMessage)} req
 * @returns {ClientData?}
 */
function getClientFromReq(req) {
  let clientID = req.session.liarsClientID;
  if (!clientID) return null;
  return ClientDataStore.get(clientID);
}

function main() {
  // TODO: (spencer) Harden cookie validation to prevent stolen cookies.
  let sessionRouter = session({
    cookie: { path: '/', httpOnly: true, secure: true, sameSite: true, maxAge: 24 * 60 * 60 },
    saveUninitialized: false,
    store: new FileStore({
      path: SESSION_STORE_PATH,
      ttl: 24 * 60 * 60,
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
  // TODO: (spencer) Currently just have a single lobby. Increase to multi-lobby support later.

  httpsServer.listen(8080);
}

main();
