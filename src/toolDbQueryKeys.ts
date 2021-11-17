import { textRandom } from ".";
import ToolDb from "./tooldb";
import getIpFromUrl from "./utils/getIpFromUrl";

/**
 * Triggers a QUERY request to other peers.
 * @param key start of the key
 * @param userNamespaced If this key bolongs to a user or its public.
 * @returns Promise<Data>
 */
export default function toolDbQueryKeys(
  this: ToolDb,
  key: string,
  userNamespaced = false
): Promise<string[] | null> {
  return new Promise((resolve, reject) => {
    if (userNamespaced && this.user?.pubKey === undefined) {
      reject(new Error("You are not authorized yet!"));
      return;
    }
    const finalKey = userNamespaced ? `:${this.user?.pubKey}.${key}` : key;
    if (this.options.debug) {
      console.log("QUERY > " + finalKey);
    }

    const msgId = textRandom(10);

    this.addIdListener(msgId, (msg) => {
      if (this.options.debug) {
        console.log("QUERY RECV  > " + finalKey, msg);
      }
      if (msg.type === "queryAck") {
        resolve(msg.keys);
      }
    });

    // Do get
    this.websockets.send({
      type: "query",
      to: this.websockets.activePeers.map(getIpFromUrl),
      key: finalKey,
      id: msgId,
    });
  });
}