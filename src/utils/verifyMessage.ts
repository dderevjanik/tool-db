import sha256 from "./sha256";
import { VerifyResult, VerificationData } from "../types/message";
import decodeKeyString from "./crypto/decodeKeyString";
import importKey from "./crypto/importKey";
import verifyData from "./crypto/verifyData";
import fromBase64 from "./fromBase64";
// import sha256 from "./sha256";

/**
 * Verifies a message validity (PoW, pubKey, timestamp, signatures)
 * @param msg AnyMessage
 * @param pow amount of proof of work required, number of leading zeroes (default is 0/no pow)
 * @returns boolean or undefined if the message type does not match
 */
export default async function verifyMessage<T>(
  msg: Partial<VerificationData<T>>,
  pow = 0
): Promise<VerifyResult> {
  // console.log("verify: ", msg);
  const strData = JSON.stringify(msg.v);

  if (
    msg.t === undefined ||
    msg.k === undefined ||
    msg.h === undefined ||
    msg.p === undefined ||
    msg.s === undefined
  ) {
    return VerifyResult.InvalidData;
  }

  // Max clock shift allowed is ten seconds
  if (msg.t > new Date().getTime() + 10000) {
    // console.warn("Invalid message timestamp.");
    return VerifyResult.InvalidTimestamp;
  }

  // This is a user namespace
  let publicKeyNamespace: false | string = false;
  if (msg.k.slice(0, 1) == ":") {
    publicKeyNamespace = msg.k.split(".")[0].slice(1);
  }

  const pubKeyString = msg.p;

  if (publicKeyNamespace && publicKeyNamespace !== pubKeyString) {
    // console.warn("Provided pub keys do not match");
    return VerifyResult.PubKeyMismatch;
  }

  // Verify hash and nonce (adjust zeroes for difficulty of the network)
  // While this POW does not enforce security per-se, it does make it harder
  // for attackers to spam the network, and could be adjusted by peers.
  // Disabled for now because it is painful on large requests
  if (pow > 0) {
    if (msg.h.slice(0, pow) !== new Array(pow).fill("0").join("")) {
      console.warn("No valid hash (no pow)");
      return VerifyResult.NoProofOfWork;
    }

    if (sha256(`${strData}${pubKeyString}${msg.t}${msg.n}`) !== msg.h) {
      // console.warn("Specified hash does not generate a valid pow");
      return VerifyResult.InvalidHashNonce;
    }
  }

  const pubKey = await importKey(
    decodeKeyString(pubKeyString),
    "spki",
    "ECDSA",
    ["verify"]
  );

  // console.log("Message verification: ", msg.hash, pubKeyString, msg);

  const verified = await verifyData(msg.h, fromBase64(msg.s), pubKey);
  // console.warn(`Signature validation: ${verified ? "Sucess" : "Failed"}`);

  return verified ? VerifyResult.Verified : VerifyResult.InvalidSignature;
}
