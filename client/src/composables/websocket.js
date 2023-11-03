import { onMounted, onUnmounted, ref } from "vue";

const MAX_BACKOFF_TIMER_SEC = 8;
const STARTING_BACKOFF_TIMER_SEC = 1;

export const WS_CONNECTION_STATE = {
  CONNECTED: "CONNECTED",
  CONNECTING: "CONNECTING",
  DISCONNECTED: "DISCONNECTED"
}

export function useWebSocket(onJSONMsg) {
  /** @type {WebSocket?} */
  let ws = null;
  /** @type {import("vue").Ref<string>} */
  var wsConnectionState = ref(WS_CONNECTION_STATE.CONNECTING);
  var currentBackoffTimer = STARTING_BACKOFF_TIMER_SEC;
  /**
   *
   * @param {Object<string, any>} obj
   * @returns
   */
  function sendMsg(obj) {
    if (!wsConnectionState.value) return;
    ws.send(JSON.stringify(obj))
  }

  function onClose(ev) {
    if (currentBackoffTimer > MAX_BACKOFF_TIMER_SEC) {
      wsConnectionState.value = WS_CONNECTION_STATE.DISCONNECTED;
      return;
    }
    wsConnectionState.value = WS_CONNECTION_STATE.CONNECTING;
    setTimeout(() => {
      ws = new WebSocket(`wss://${location.host}`);
      setupWS(ws);
    }, currentBackoffTimer * 1000);
    currentBackoffTimer *= 2;
  }

  function setupWS(ws) {
    ws.addEventListener("open", (event) => {
      wsConnectionState.value = WS_CONNECTION_STATE.CONNECTED;
      currentBackoffTimer = STARTING_BACKOFF_TIMER_SEC;
    });

    ws.addEventListener("error", (event) => {
      console.error(`Websocket error: ${JSON.stringify(event, ["message", "arguments", "type", "name"])}`);
    });

    // Listen for messages
    ws.addEventListener("message", (event) => {
      let msg = null;
      try {
        msg = JSON.parse(event.data);
      } catch (e) {
        console.error(`Error processing JSON for message ${e}`);
        return;
      }
      if (msg) onJSONMsg(msg);
    });

    ws.addEventListener('close', onClose);
  }

  onMounted(() => {
    ws = new WebSocket(`wss://${location.host}`);
    setupWS(ws);
  })

  onUnmounted(() => {
    if (ws) {
      ws.removeEventListener('close', onClose);
      ws.close();
      ws = null;
    }
    wsConnectionState.value = WS_CONNECTION_STATE.DISCONNECTED;
  });

  return { wsConnectionState, sendMsg };
}
