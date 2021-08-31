import decodeKeyString from "./utils/crypto/decodeKeyString";
import decryptWithPass from "./utils/crypto/decryptWithPass";
import { KeyPair } from "./utils/crypto/generateKeyPair";
import importKey from "./utils/crypto/importKey";
import base64ToUint8 from "./utils/base64ToUint8";
import catchReturn from "./utils/catchReturn";
import fromBase64 from "./utils/fromBase64";
import sha256 from "./utils/sha256";

import { UserRootData } from "./types/graph";
import ToolDbClient from "./toolDbClient";

export default function toolDbSignIn(
  this: ToolDbClient,
  user: string,
  password: string
): Promise<
  | {
      signKeys: KeyPair;
      encryptionKeys: KeyPair;
    }
  | undefined
> {
  return new Promise((resolve, reject) => {
    this.getData<UserRootData>(`@${user}`)
      .then((_user) => {
        if (!_user) {
          reject(Error("Unvalid user data"));
          return;
        }

        if (sha256(password) !== _user.pass) {
          reject(Error("Invalid password"));
          return;
        }

        decryptWithPass(
          fromBase64(_user.keys.skpriv),
          password,
          base64ToUint8(_user.iv)
        ).then((decryptedskpriv) => {
          decryptWithPass(
            fromBase64(_user.keys.ekpriv),
            password,
            base64ToUint8(_user.iv)
          )
            .then((decryptedekpriv) => {
              const parsedKeys = {
                ..._user.keys,
                skpriv: decryptedskpriv || "",
                ekpriv: decryptedekpriv || "",
              };

              // const jsonKeys = {
              //   skpub: parsedKeys.skpub,
              //   skpriv: parsedKeys.skpriv,
              //   ekpub: parsedKeys.ekpub,
              //   ekpriv: parsedKeys.ekpriv,
              // };
              // localStorage.setItem("keys", JSON.stringify(jsonKeys));

              async function importKeys() {
                const skpub = await importKey(
                  decodeKeyString(parsedKeys.skpub),
                  "spki",
                  "ECDSA",
                  ["verify"]
                ).catch(catchReturn);

                const skpriv = await importKey(
                  decodeKeyString(parsedKeys.skpriv),
                  "pkcs8",
                  "ECDSA",
                  ["sign"]
                ).catch(catchReturn);

                const ekpub = await importKey(
                  decodeKeyString(parsedKeys.ekpub),
                  "spki",
                  "ECDH",
                  []
                ).catch(catchReturn);

                const ekpriv = await importKey(
                  decodeKeyString(parsedKeys.ekpriv),
                  "pkcs8",
                  "ECDH",
                  ["deriveKey", "deriveBits"]
                ).catch(catchReturn);

                return { skpub, skpriv, ekpub, ekpriv };
              }

              importKeys()
                .then(({ skpub, skpriv, ekpub, ekpriv }) => {
                  if (!skpub || !skpriv || !ekpub || !ekpriv) {
                    reject(new Error("Could not import keys"));
                  } else {
                    const newKeys = {
                      signKeys: {
                        publicKey: skpub,
                        privateKey: skpriv,
                      },
                      encryptionKeys: {
                        publicKey: ekpub,
                        privateKey: ekpriv,
                      },
                    };

                    this.user = {
                      keys: newKeys,
                      name: user,
                      pubKey: _user.keys.skpub,
                    };
                    resolve(newKeys);
                  }
                })
                .catch(catchReturn);
            })
            .catch(catchReturn);
        });
      })
      .catch(console.warn);
  });
}