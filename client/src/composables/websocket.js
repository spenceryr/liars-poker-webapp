import { onMounted, onUnmounted, ref } from "vue";


export function useWebSocket(onJSONMsg) {
  /** @type {WebSocket?} */
  let ws = null;
  var connected = ref(false);
  /**
   *
   * @param {Object<string, any>} obj
   * @returns
   */
  var sendMsg = function (obj) {
    if (!connected.value) return;
    ws.send(JSON.stringify(obj))
  }

  // TODO: (spencer) Maybe some exponential backoff + max retries?
  function onClose(ev) {
    connected.value = false;
    ws = new WebSocket(`wss://${location.host}`);
    setupWS(ws);
  }

  function setupWS(ws) {
    ws.addEventListener("open", (event) => {
      connected.value = true;
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
    connected.value = false;
  });

  return { connected, sendMsg };
}
