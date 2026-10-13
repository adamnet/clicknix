// src/config.js
var MAX_RULE_SOURCE_BYTES = 4 * 1024 * 1024;
var MAX_RULE_BUNDLE_BYTES = 8 * MAX_RULE_SOURCE_BYTES;
var MAX_SCAN_BYTES = 2 * 1024 * 1024;
var MAX_CAPTURE_CHARS = 15e5;
var SCAN_WINDOW_OVERLAP_CHARS = 64 * 1024;

// src/scanner-protocol.js
var SCANNER_TARGETS = Object.freeze({
  HOST: "scanner-host"
});
var SCANNER_REQUESTS = Object.freeze({
  INITIALIZE: "initialize",
  SCAN: "scan",
  STATUS: "status"
});
var SCANNER_WORKER_MESSAGES = Object.freeze({
  INITIALIZED: "initialized",
  INITIALIZATION_FAILED: "initialization-failed",
  SCAN: "scan",
  SCAN_FAILED: "scan-failed",
  SCAN_RESULT: "scan-result"
});
var SCANNER_FAILURE_CODES = Object.freeze({
  HOST_UNAVAILABLE: "host-unavailable",
  INITIALIZATION_FAILED: "initialization-failed",
  INVALID_REQUEST: "invalid-request",
  INVALID_SCAN_RESULT: "invalid-scan-result",
  OVERLAPPING_SCAN: "overlapping-scan",
  RESULT_PROCESSING_FAILED: "result-processing-failed",
  RESULT_TRANSPORT_FAILED: "result-transport-failed",
  SCAN_TIMEOUT: "scan-timeout",
  WORKER_CRASHED: "worker-crashed",
  WORKER_UNAVAILABLE: "worker-unavailable",
  YARA_SCAN_EXCEPTION: "yara-scan-exception"
});
var SCANNER_TIMEOUTS = Object.freeze({
  INITIALIZE_MS: 6e4,
  SCAN_MS: 3e4
});
function createScannerFailure({
  code,
  stage,
  message,
  terminal = false,
  retryable = false
}) {
  return {
    code,
    stage,
    message: String(message),
    terminal: terminal === true,
    retryable: retryable === true
  };
}
function isScannerFailure(value) {
  return Boolean(
    value && typeof value === "object" && typeof value.code === "string" && typeof value.stage === "string" && typeof value.message === "string" && typeof value.terminal === "boolean" && typeof value.retryable === "boolean"
  );
}

// src/scanner.js
var SCANNER_HOST_PATH = "scanner-host.html";
var HOST_RESPONSE_GRACE_MS = 5e3;
var runtime;
var runtimePromise;
var runtimeStatus = { state: "initializing" };
var hostNeedsReset = false;
var scanQueue = Promise.resolve();
async function initializeScannerRuntime() {
  if (runtime) {
    return runtime;
  }
  if (!runtimePromise) {
    runtimePromise = createRuntime().finally(() => {
      runtimePromise = void 0;
    });
  }
  return runtimePromise;
}
async function getScannerStatus() {
  if (runtimeStatus.state !== "ready") {
    return { ...runtimeStatus };
  }
  let hostStatus;
  try {
    ({ scannerStatus: hostStatus } = await requestScanner({ type: SCANNER_REQUESTS.STATUS }));
  } catch (error) {
    return failedStatus(error.scannerFailure);
  }
  if (hostStatus?.state === "failed") {
    return failedStatus(isScannerFailure(hostStatus.failure) ? hostStatus.failure : invalidHostResponse("ClickNix scanner host returned an invalid failed status"));
  }
  if (["initializing", "ready"].includes(hostStatus?.state)) {
    return {
      state: hostStatus.state,
      ...hostStatus.runtime?.rulesVersion ? { rulesVersion: hostStatus.runtime.rulesVersion } : {}
    };
  }
  return failedStatus(invalidHostResponse("ClickNix scanner host returned an invalid status"));
}
function scanText(text) {
  return scanBytes(new TextEncoder().encode(text));
}
async function scanBytes(source) {
  const [result] = await scanBatch([source]);
  if (result.error) throw result.error;
  return result;
}
async function scanBatch(buffers) {
  const previousScan = scanQueue;
  let releaseScan;
  scanQueue = new Promise((resolve) => {
    releaseScan = resolve;
  });
  await previousScan;
  try {
    return await scanBatchNow(buffers);
  } finally {
    releaseScan();
  }
}
async function scanBatchNow(buffers) {
  const byteLength = buffers.reduce((total, buffer) => total + buffer.byteLength, 0);
  if (byteLength > MAX_SCAN_BYTES) {
    throw new Error(`Scan buffers of ${byteLength} bytes exceed the scan byte limit`);
  }
  let result;
  try {
    result = await scanOnce(buffers, byteLength);
  } catch (error) {
    if (error?.scannerFailure?.retryable !== true) {
      throw error;
    }
    result = await scanOnce(buffers, byteLength);
  }
  if (result?.results?.length !== buffers.length) {
    throw scannerError(invalidHostResponse("ClickNix scanner host returned an invalid scan result"));
  }
  return result.results.map(({ matches, warnings, failure }) => failure ? { error: scannerError(isScannerFailure(failure) ? failure : invalidHostResponse("ClickNix scanner host returned an invalid buffer failure")) } : { rulesVersion: result.rulesVersion, matches, warnings });
}
async function scanOnce(buffers, byteLength) {
  await initializeScannerRuntime();
  const requestId = crypto.randomUUID();
  try {
    await deliverPayload(requestId, buffers, byteLength);
  } catch (error) {
    const failure = hostUnavailable(error);
    forgetRuntime(failure);
    throw scannerError(failure);
  }
  const response = await requestRuntime(
    { type: SCANNER_REQUESTS.SCAN, requestId, lengths: buffers.map((buffer) => buffer.byteLength) },
    SCANNER_TIMEOUTS.SCAN_MS
  );
  return response.result;
}
async function deliverPayload(requestId, buffers, byteLength) {
  const hostURL = chrome.runtime.getURL(SCANNER_HOST_PATH);
  const windows = await self.clients.matchAll({ includeUncontrolled: true, type: "window" });
  const host = windows.find((client) => client.url === hostURL);
  if (!host) {
    throw new Error("scanner host document is not open");
  }
  const payload = new Uint8Array(byteLength);
  let offset = 0;
  for (const buffer of buffers) {
    payload.set(buffer, offset);
    offset += buffer.byteLength;
  }
  host.postMessage({ requestId, payload: payload.buffer }, [payload.buffer]);
}
async function createRuntime() {
  try {
    await ensureScannerHost();
  } catch (error) {
    const failure = hostUnavailable(error);
    forgetRuntime(failure);
    throw scannerError(failure);
  }
  const response = await requestRuntime(
    { type: SCANNER_REQUESTS.INITIALIZE },
    SCANNER_TIMEOUTS.INITIALIZE_MS
  );
  runtime = response.runtime;
  runtimeStatus = {
    state: "ready",
    rulesVersion: runtime.rulesVersion
  };
  return runtime;
}
async function ensureScannerHost() {
  const hostURL = chrome.runtime.getURL(SCANNER_HOST_PATH);
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [hostURL]
  });
  if (contexts.length > 0 && hostNeedsReset) {
    await chrome.offscreen.closeDocument();
  } else if (contexts.length > 0) {
    return;
  }
  hostNeedsReset = false;
  await chrome.offscreen.createDocument({
    url: SCANNER_HOST_PATH,
    reasons: ["WORKERS"],
    justification: "Run the YARA-X WebAssembly scanner in a dedicated worker."
  });
}
async function requestRuntime(request, hostTimeoutMs) {
  try {
    return await requestScanner(request, hostTimeoutMs);
  } catch (error) {
    const failure = error.scannerFailure;
    if (failure.terminal) {
      forgetRuntime(failure);
    }
    throw error;
  }
}
function forgetRuntime(failure) {
  runtime = void 0;
  runtimeStatus = failedStatus(failure);
  if (failure.code === SCANNER_FAILURE_CODES.HOST_UNAVAILABLE) {
    hostNeedsReset = true;
  }
}
async function requestScanner(request, hostTimeoutMs = 0) {
  let response;
  let timer;
  try {
    const timeout = new Promise((_resolve, reject) => {
      timer = setTimeout(
        () => reject(new Error(`no response within ${(hostTimeoutMs + HOST_RESPONSE_GRACE_MS) / 1e3}s`)),
        hostTimeoutMs + HOST_RESPONSE_GRACE_MS
      );
    });
    response = await Promise.race([
      chrome.runtime.sendMessage({
        target: SCANNER_TARGETS.HOST,
        ...request
      }),
      timeout
    ]);
  } catch (error) {
    throw scannerError(hostUnavailable(error));
  } finally {
    clearTimeout(timer);
  }
  if (response?.ok === true) {
    return response;
  }
  throw scannerError(isScannerFailure(response?.failure) ? response.failure : invalidHostResponse("ClickNix scanner host returned an invalid response"));
}
function hostUnavailable(error) {
  return createScannerFailure({
    code: SCANNER_FAILURE_CODES.HOST_UNAVAILABLE,
    stage: "host-transport",
    message: `ClickNix scanner host is unavailable: ${errorDetail(error)}`,
    terminal: true,
    retryable: true
  });
}
function invalidHostResponse(message) {
  return createScannerFailure({
    code: SCANNER_FAILURE_CODES.RESULT_TRANSPORT_FAILED,
    stage: "host-protocol",
    message
  });
}
function scannerError(failure) {
  const error = new Error(failure.message);
  error.scannerFailure = failure;
  return error;
}
function failedStatus(failure) {
  return {
    state: "failed",
    error: failure.message,
    failure
  };
}
function errorDetail(error) {
  return error instanceof Error ? error.message : String(error);
}

// src/clipboard-command.js
var WINDOW_OPTION = String.raw`(?:^|\s)[-/\u2013\u2014\u2015]w(?:i(?:n(?:d(?:o(?:w(?:s(?:t(?:y(?:l(?:e)?)?)?)?)?)?)?)?)?)?\s+["']?`;
var NAMED_HIDDEN_WINDOW = new RegExp(
  String.raw`${WINDOW_OPTION}(?:h(?:i(?:d(?:d(?:e(?:n)?)?)?)?)?|mi(?:n(?:i(?:m(?:i(?:z(?:e(?:d)?)?)?)?)?)?)?)(?![\w.])|--headless\b`,
  "i"
);
var NUMERIC_HIDDEN_WINDOWS = new RegExp(String.raw`${WINDOW_OPTION}[12](?![\w.])`, "gi");
var CLIPBOARD_NOTICE_MESSAGE = "clipboard-notice";
var CLIPBOARD_COMMAND = Object.freeze({
  // Disguised, hidden, encoded or remote-loader command: the ClickFix pattern.
  SCAM: "scam",
  // A command that downloads and runs code, like many installer one-liners.
  DOWNLOAD_EXECUTE: "download-execute"
});

// src/scan-window.js
var charCodeAt = Function.prototype.call.bind(String.prototype.charCodeAt);
function fitWindow(text, maxChars, maxBytes, start = 0) {
  const end = text.length - start < maxChars ? text.length : start + maxChars;
  let index = start;
  let bytes = 0;
  while (index < end) {
    const code = charCodeAt(text, index);
    let units = 1;
    let size = 3;
    if (code < 128) {
      size = 1;
    } else if (code < 2048) {
      size = 2;
    } else if (code >= 55296 && code <= 56319) {
      const next = charCodeAt(text, index + 1);
      if (next >= 56320 && next <= 57343) {
        units = 2;
        size = 4;
      }
    }
    if (index + units > end || bytes + size > maxBytes) break;
    index += units;
    bytes += size;
  }
  return { chars: index - start, bytes };
}
function utf8Length(text) {
  return fitWindow(text, text.length, Infinity).bytes;
}
var TextWindows = class {
  #text = "";
  // Where the unfinished window starts in #text, and its UTF-8 size.
  #start = 0;
  #bytes = 0;
  // Adds text and returns the windows it completed.
  push(text) {
    this.#text = this.#text.slice(this.#start) + text;
    this.#start = 0;
    this.#bytes += utf8Length(text);
    const windows = [];
    while (this.#text.length - this.#start > MAX_CAPTURE_CHARS || this.#bytes > MAX_SCAN_BYTES) {
      const { chars, bytes } = fitWindow(this.#text, MAX_CAPTURE_CHARS, MAX_SCAN_BYTES, this.#start);
      const end = this.#start + chars;
      windows.push(this.#text.slice(this.#start, end));
      this.#start = end - SCAN_WINDOW_OVERLAP_CHARS;
      this.#bytes -= bytes - fitWindow(this.#text, SCAN_WINDOW_OVERLAP_CHARS, Infinity, this.#start).bytes;
    }
    return windows;
  }
  // Returns the last window, if any text is left.
  end() {
    const text = this.#text.slice(this.#start);
    this.#text = "";
    this.#start = 0;
    this.#bytes = 0;
    return text ? [text] : [];
  }
};

// src/script-source.js
var DATA_PREFIX = "data:";
var DATA_URL_START = /data:/gi;
var MAX_DATA_SCRIPT_DEPTH = 3;
var DATA_CHUNK_BYTES = 64 * 1024;
var URL_TAB_OR_NEWLINE = /[\t\n\r]/;
var BASE64_VALUES = new Int8Array(128).fill(-1);
[..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"].forEach((character, value) => {
  BASE64_VALUES[character.charCodeAt(0)] = value;
});
var QUOTE = /["'`]/g;
var JAVASCRIPT_ESCAPE_SOURCE = String.raw`\\(?:u\{([0-9A-Fa-f]+)\}|u([0-9A-Fa-f]{4})|x([0-9A-Fa-f]{2})|(\r\n|[\s\S]))`;
var JAVASCRIPT_ESCAPE = new RegExp(JAVASCRIPT_ESCAPE_SOURCE, "y");
var JAVASCRIPT_ESCAPES = new RegExp(JAVASCRIPT_ESCAPE_SOURCE, "g");
var CUT_JAVASCRIPT_ESCAPE = /\\(?:u\{[0-9A-Fa-f]*|u[0-9A-Fa-f]{0,3}|x[0-9A-Fa-f]?)?$/y;
var JAVASCRIPT_ESCAPE_CHARACTERS = { b: "\b", f: "\f", n: "\n", r: "\r", t: "	", v: "\v", 0: "\0" };
var JAVASCRIPT_LINE_TERMINATORS = ["\r\n", "\n", "\r", "\u2028", "\u2029"];
function* dataScriptWindows(value, fallback) {
  const queue = [{ depth: 0, url: value }];
  const seen = /* @__PURE__ */ new Set();
  let layers = 0;
  for (let next = 0; next < queue.length; next += 1) {
    const { depth, url } = queue[next];
    queue[next] = void 0;
    const body = parseDataURL(url);
    if (!body) continue;
    const [head] = dataBodyBytes(body);
    const encodings = scriptEncodings(head, body.charset, fallback);
    for (const encoding of encodings) {
      const nested = depth < MAX_DATA_SCRIPT_DEPTH ? new NestedDataURLs((nestedURL, leaf) => {
        const digest = urlDigest(nestedURL);
        const key = leaf ? `${digest}leaf` : digest;
        if (seen.has(key) || seen.has(digest)) return;
        seen.add(key);
        queue.push({ depth: leaf ? MAX_DATA_SCRIPT_DEPTH : depth + 1, url: nestedURL });
      }) : void 0;
      let layer;
      const decoding = decodedWindows(body, encoding, nested);
      let step;
      while (!(step = decoding.next()).done) {
        layer ??= ++layers;
        yield { layer, text: step.value };
      }
      if (step.value && !encodings[0].startsWith("utf-16")) break;
    }
  }
}
function* decodedWindows(body, encoding, nested) {
  const decoder = new TextDecoder(encoding);
  const windows = new TextWindows();
  const take = (text) => {
    nested?.push(text);
    return windows.push(text);
  };
  let plain = true;
  for (const bytes of dataBodyBytes(body)) {
    plain &&= isPlainASCII(bytes);
    yield* take(decoder.decode(bytes, { stream: true }));
  }
  yield* take(decoder.decode());
  nested?.end();
  yield* windows.end();
  return plain;
}
function urlDigest(url) {
  const words = sha256(new TextEncoder().encode(url));
  return String.fromCharCode(...words.slice(0, 4).flatMap((word) => [word >>> 16, word & 65535]));
}
var SHA256_K = new Uint32Array([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
function sha256(bytes) {
  const length = bytes.length;
  const blocks = new Uint8Array(Math.ceil((length + 9) / 64) * 64);
  blocks.set(bytes);
  blocks[length] = 128;
  const view = new DataView(blocks.buffer);
  view.setUint32(blocks.length - 8, Math.floor(length / 536870912));
  view.setUint32(blocks.length - 4, length * 8 >>> 0);
  const hash = [1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225];
  const w = new Uint32Array(64);
  const rotate = (value, bits) => value >>> bits | value << 32 - bits;
  for (let offset = 0; offset < blocks.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) w[index] = view.getUint32(offset + index * 4);
    for (let index = 16; index < 64; index += 1) {
      const s0 = rotate(w[index - 15], 7) ^ rotate(w[index - 15], 18) ^ w[index - 15] >>> 3;
      const s1 = rotate(w[index - 2], 17) ^ rotate(w[index - 2], 19) ^ w[index - 2] >>> 10;
      w[index] = w[index - 16] + s0 + w[index - 7] + s1;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const t1 = h + (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)) + (e & f ^ ~e & g) + SHA256_K[index] + w[index];
      const t2 = (rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)) + (a & b ^ a & c ^ b & c);
      h = g;
      g = f;
      f = e;
      e = d + t1 >>> 0;
      d = c;
      c = b;
      b = a;
      a = t1 + t2 >>> 0;
    }
    [a, b, c, d, e, f, g, h].forEach((value, index) => {
      hash[index] = hash[index] + value >>> 0;
    });
  }
  return hash;
}
function scriptEncodings(head, charset, fallback) {
  const classic = bomEncoding(head) ?? encodingName(charset) ?? encodingName(fallback) ?? "utf-8";
  return classic === "utf-8" ? [classic] : [classic, "utf-8"];
}
function encodingName(label) {
  if (typeof label !== "string" || label === "") return void 0;
  try {
    return new TextDecoder(label).encoding;
  } catch {
    return void 0;
  }
}
function contentTypeCharset(contentType) {
  return /;\s*charset\s*=\s*"?([^";\s]+)/i.exec(contentType ?? "")?.[1];
}
async function* scriptTextWindows(readChunk, charset, fallback) {
  let head = new Uint8Array(0);
  for (let chunk; head.length < 3 && (chunk = await readChunk()); ) {
    const joined = new Uint8Array(head.length + chunk.length);
    joined.set(head);
    joined.set(chunk, head.length);
    head = joined;
  }
  const decodings = scriptEncodings(head, charset, fallback).map((encoding) => ({
    decoder: new TextDecoder(encoding),
    windows: new TextWindows()
  }));
  let plain = true;
  for (let bytes = head; bytes; bytes = await readChunk()) {
    plain &&= isPlainASCII(bytes);
    for (const { decoder, windows } of decodings) {
      yield* windows.push(decoder.decode(bytes, { stream: true }));
    }
  }
  for (const { decoder, windows } of decodings) {
    yield* windows.push(decoder.decode());
    yield* windows.end();
  }
  return { declared: (bomEncoding(head) ?? encodingName(charset)) !== void 0, plain };
}
function decodesAlike(body, scanned, fallback) {
  return fallback === scanned || fallback === "utf-8" || body.declared || body.plain && !fallback.startsWith("utf-16");
}
function isPlainASCII(bytes) {
  for (let index = 0; index < bytes.length; index += 1) {
    const byte = bytes[index];
    if (byte >= 128 || byte === 14 || byte === 15 || byte === 27) return false;
  }
  return true;
}
function parseDataURL(value) {
  if (typeof value !== "string") return null;
  let start = 0;
  let end = value.length;
  while (start < end && value.charCodeAt(start) <= 32) start += 1;
  while (end > start && value.charCodeAt(end - 1) <= 32) end -= 1;
  let url = value.slice(start, end);
  if (URL_TAB_OR_NEWLINE.test(url)) url = url.replace(new RegExp(URL_TAB_OR_NEWLINE, "g"), "");
  if (url.slice(0, DATA_PREFIX.length).toLowerCase() !== DATA_PREFIX) return null;
  const fragment = url.indexOf("#");
  if (fragment >= 0) url = url.slice(0, fragment);
  const comma = url.indexOf(",", DATA_PREFIX.length);
  if (comma < 0) return null;
  const parameters = url.slice(DATA_PREFIX.length, comma).split(";").map((parameter) => parameter.trim().toLowerCase());
  const base64 = parameters.length > 1 && parameters.at(-1) === "base64";
  const charset = parameters.slice(1).find((parameter) => parameter.startsWith("charset="))?.slice(8);
  const text = url.slice(comma + 1);
  return (base64 ? base64Length(text) : text.length) > 0 ? { text, base64, charset } : null;
}
function base64Length(text) {
  let symbols = 0;
  let padding = 0;
  if (!text.includes("%")) {
    const stripped = text.replace(/[\t\n\f\r ]+/g, "");
    padding = /^[A-Za-z0-9+/]*(={0,2})$/.exec(stripped)?.[1].length ?? -1;
    symbols = stripped.length - padding;
  } else {
    for (let index = 0; index < text.length && padding >= 0; index += 1) {
      let code = text.charCodeAt(index);
      const escaped = code === 37 ? escapedByte(text, index) : -1;
      if (escaped >= 0) {
        code = escaped;
        index += 2;
      }
      if (isASCIIWhitespace(code)) continue;
      if (code === 61) {
        padding += 1;
      } else if (padding > 0 || code >= 128 || BASE64_VALUES[code] < 0) {
        padding = -1;
      } else {
        symbols += 1;
      }
    }
  }
  const missingPadding = (4 - (symbols + padding) % 4) % 4;
  return padding < 0 || padding + missingPadding > 2 || symbols % 4 === 1 ? -1 : Math.floor(symbols * 3 / 4);
}
function* dataBodyBytes({ text, base64 }) {
  const flushAt = DATA_CHUNK_BYTES - 6;
  let bytes = new Uint8Array(Math.min(DATA_CHUNK_BYTES, 3 * text.length + 2));
  let length = 0;
  let quantum = 0;
  let symbols = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (length > flushAt) {
      yield bytes.subarray(0, length);
      bytes = new Uint8Array(DATA_CHUNK_BYTES);
      length = 0;
    }
    let code = text.charCodeAt(index);
    const escaped = code === 37 ? escapedByte(text, index) : -1;
    if (escaped >= 0) {
      code = escaped;
      index += 2;
    }
    if (base64) {
      if (isASCIIWhitespace(code)) continue;
      if (code === 61) break;
      quantum = quantum << 6 | BASE64_VALUES[code];
      if (++symbols === 4) {
        bytes[length++] = quantum >> 16;
        bytes[length++] = quantum >> 8 & 255;
        bytes[length++] = quantum & 255;
        quantum = 0;
        symbols = 0;
      }
    } else if (escaped >= 0 || code < 128) {
      bytes[length++] = code;
    } else if (code < 2048) {
      bytes[length++] = 192 | code >> 6;
      bytes[length++] = 128 | code & 63;
    } else {
      const next = text.charCodeAt(index + 1);
      if (code >= 55296 && code <= 56319 && next >= 56320 && next <= 57343) {
        const point = 65536 + (code - 55296 << 10) + (next - 56320);
        bytes[length++] = 240 | point >> 18;
        bytes[length++] = 128 | point >> 12 & 63;
        bytes[length++] = 128 | point >> 6 & 63;
        bytes[length++] = 128 | point & 63;
        index += 1;
        continue;
      }
      if (code >= 55296 && code <= 57343) code = 65533;
      bytes[length++] = 224 | code >> 12;
      bytes[length++] = 128 | code >> 6 & 63;
      bytes[length++] = 128 | code & 63;
    }
  }
  if (symbols === 2) {
    bytes[length++] = quantum >> 4;
  } else if (symbols === 3) {
    bytes[length++] = quantum >> 10;
    bytes[length++] = quantum >> 2 & 255;
  }
  if (length > 0) yield bytes.subarray(0, length);
}
function isASCIIWhitespace(code) {
  return code === 9 || code === 10 || code === 12 || code === 13 || code === 32;
}
function bomEncoding(bytes) {
  if (bytes[0] === 239 && bytes[1] === 187 && bytes[2] === 191) return "utf-8";
  if (bytes[0] === 255 && bytes[1] === 254) return "utf-16le";
  if (bytes[0] === 254 && bytes[1] === 255) return "utf-16be";
  return void 0;
}
function escapedByte(text, index) {
  const high = hexDigit(text.charCodeAt(index + 1));
  const low = hexDigit(text.charCodeAt(index + 2));
  return high >= 0 && low >= 0 ? high * 16 + low : -1;
}
function hexDigit(byte) {
  if (byte >= 48 && byte <= 57) {
    return byte - 48;
  }
  const lower = byte | 32;
  return lower >= 97 && lower <= 102 ? lower - 87 : -1;
}
var NestedDataURLs = class {
  #found;
  #kept = "";
  #parts = [];
  #partsLength = 0;
  constructor(found) {
    this.#found = found;
  }
  push(text) {
    this.#parts.push(text);
    this.#partsLength += text.length;
    if (this.#partsLength >= this.#kept.length) this.#search(false);
  }
  end() {
    this.#search(true);
    this.#kept = "";
  }
  #search(final) {
    const source = this.#kept + this.#parts.join("");
    this.#parts = [];
    this.#partsLength = 0;
    const undecided = findDataJavaScriptURLs(source, final, (url, leaf) => {
      if (parseDataURL(url) !== null) this.#found(structuredClone(url), leaf);
    });
    this.#kept = source.slice(undecided);
  }
};
function findDataJavaScriptURLs(source, final, add) {
  let cursor = 0;
  let quote = -1;
  let unquoted = -1;
  let comma = -1;
  let unquotedComma = -1;
  let leafEnd = -1;
  for (; ; ) {
    if (quote < cursor) quote = nextMatch(QUOTE, source, cursor);
    if (unquoted < cursor) unquoted = nextMatch(DATA_URL_START, source, cursor);
    if (quote < unquoted) {
      const literal = startsDataURL(source, quote + 1, source[quote], final);
      if (literal === void 0) return quote;
      const plain = literal && source.slice(quote + 1, quote + 1 + DATA_PREFIX.length).toLowerCase() === DATA_PREFIX;
      if (!literal || !plain && quote < leafEnd) {
        cursor = quote + 1;
        continue;
      }
      const end2 = findClosingQuote(source, quote + 1, source[quote]);
      if (end2 === source.length && !final) return quote;
      const value = unescapeJavaScriptString(source.slice(quote + 1, end2));
      if (!plain && unquoted < end2) {
        add(value, true);
        leafEnd = end2;
        cursor = quote + 1;
        continue;
      }
      add(value, false);
      cursor = end2;
      continue;
    }
    if (unquoted === source.length) {
      return final ? source.length : Math.max(cursor, source.length - DATA_PREFIX.length + 1);
    }
    const start = unquoted;
    cursor = start + DATA_PREFIX.length;
    if (comma < cursor) comma = source.indexOf(",", cursor);
    if (comma < 0) {
      if (!final) return start;
      comma = source.length;
    }
    if (comma === unquotedComma || comma === source.length) continue;
    unquotedComma = comma;
    if (!/;\s*base64\s*$/i.test(source.slice(start, comma))) continue;
    let end = comma + 1;
    while (end < source.length && isEncodedBase64Character(source, end)) {
      end += source[end] === "%" ? 3 : 1;
    }
    if (end > source.length - 3 && !final) return start;
    add(source.slice(start, end), false);
    cursor = end;
  }
}
function nextMatch(pattern, source, index) {
  pattern.lastIndex = index;
  return pattern.exec(source)?.index ?? source.length;
}
function startsDataURL(source, index, quote, final) {
  for (let matched = 0; matched < DATA_PREFIX.length; ) {
    if (index >= source.length) return final ? false : void 0;
    if (source[index] === quote) return false;
    let code = source.charCodeAt(index);
    index += 1;
    if (code === 92) {
      CUT_JAVASCRIPT_ESCAPE.lastIndex = index - 1;
      if (!final && CUT_JAVASCRIPT_ESCAPE.test(source)) return void 0;
      JAVASCRIPT_ESCAPE.lastIndex = index - 1;
      const escape = JAVASCRIPT_ESCAPE.exec(source);
      if (escape === null) return false;
      index = JAVASCRIPT_ESCAPE.lastIndex;
      code = javascriptEscapeValue(...escape).charCodeAt(0);
      if (Number.isNaN(code)) continue;
    }
    if (matched === 0 ? code <= 32 : code === 9 || code === 10 || code === 13) continue;
    if ((code >= 65 && code <= 90 ? code + 32 : code) !== DATA_PREFIX.charCodeAt(matched)) {
      return false;
    }
    matched += 1;
  }
  return true;
}
function findClosingQuote(source, index, quote) {
  for (let end = source.indexOf(quote, index); end >= 0; end = source.indexOf(quote, end + 1)) {
    let backslashes = 0;
    while (end - backslashes > index && source[end - backslashes - 1] === "\\") backslashes += 1;
    if (backslashes % 2 === 0) return end;
  }
  return source.length;
}
function unescapeJavaScriptString(value) {
  return value.replace(JAVASCRIPT_ESCAPES, javascriptEscapeValue);
}
function javascriptEscapeValue(escape, codePoint, unit, byte, character) {
  if (character === void 0) {
    const code = parseInt(codePoint ?? unit ?? byte, 16);
    return code <= 1114111 ? String.fromCodePoint(code) : escape;
  }
  if (JAVASCRIPT_LINE_TERMINATORS.includes(character)) {
    return "";
  }
  return JAVASCRIPT_ESCAPE_CHARACTERS[character] ?? character;
}
function isEncodedBase64Character(source, index) {
  const character = source[index];
  if (character >= "A" && character <= "Z" || character >= "a" && character <= "z" || character >= "0" && character <= "9" || ["+", "/", "="].includes(character)) {
    return true;
  }
  return character === "%" && index + 2 < source.length && /^[0-9A-Fa-f]{2}$/.test(source.slice(index + 1, index + 3));
}

// src/request-body.js
function requestBodyChunks(requestBody) {
  const chunks = requestBody?.formData && typeof requestBody.formData === "object" ? formDataChunks(requestBody.formData) : (requestBody?.raw || []).map((chunk) => chunk?.bytes).filter((bytes) => bytes instanceof ArrayBuffer).map((bytes) => new Uint8Array(bytes));
  return chunks.length === 0 ? null : chunks;
}
function* byteWindows(chunks) {
  const length = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  for (let start = 0; ; start += MAX_SCAN_BYTES - SCAN_WINDOW_OVERLAP_CHARS) {
    yield byteRange(chunks, start, Math.min(start + MAX_SCAN_BYTES, length));
    if (start + MAX_SCAN_BYTES >= length) return;
  }
}
function byteRange(chunks, start, end) {
  let window;
  let filled = 0;
  let offset = 0;
  for (const chunk of chunks) {
    const from = Math.max(start - offset, 0);
    const to = Math.min(end - offset, chunk.byteLength);
    offset += chunk.byteLength;
    if (from >= to) continue;
    if (!window && to - from === end - start) return chunk.subarray(from, to);
    window ??= new Uint8Array(end - start);
    window.set(chunk.subarray(from, to), filled);
    filled += to - from;
  }
  return window ?? new Uint8Array(0);
}
function formDataChunks(formData) {
  const encoder = new TextEncoder();
  const chunks = [];
  for (const [name, rawValues] of Object.entries(formData)) {
    const values = Array.isArray(rawValues) ? rawValues : [rawValues];
    for (const value of values) {
      chunks.push(encoder.encode(`${name}=${String(value)}
`));
    }
  }
  return chunks;
}

// src/scan-scheduler.js
var URGENT_LANES = Object.freeze([
  "top-level-url",
  "document"
]);
var FRAME_LANE = "frame";
var FRAME_URGENT_LANES = Object.freeze([
  "frame-url",
  "document"
]);
var SCAN_LANES = Object.freeze([
  "page-response",
  "document-change",
  "inline-script",
  "request-body",
  "request-url",
  "external-script",
  "data-script",
  FRAME_LANE
]);
var VIEWPOINT_TURNS = 4;
var ScanScheduler = class {
  // Tasks carry an opaque navigation owner. isLive(tabId, navigation) decides
  // whether that owner's work is still wanted, and isShown(tabId, navigation)
  // whether it belongs to the document its tab shows or loads; other live
  // work (a back/forward cached document's) is background work. No task is
  // picked before viewpointKnown settles, so a restarted worker does not take
  // the viewed tab's first work for background work.
  constructor(isLive, { isShown = isLive, viewpointKnown: viewpointKnown2 } = {}) {
    this.isLive = isLive;
    this.isShown = isShown;
    this.viewpointKnown = viewpointKnown2;
    this.tabs = /* @__PURE__ */ new Map();
    this.size = 0;
    this.sequence = 0;
    this.laneCursors = /* @__PURE__ */ new Map();
    this.frameCursors = /* @__PURE__ */ new Map();
    this.frameLaneCursors = /* @__PURE__ */ new Map();
    this.running = false;
    this.lastTabId = -1;
    this.viewpointTabId = void 0;
    this.viewpointTurns = 0;
  }
  setViewpointTab(tabId) {
    this.viewpointTabId = tabId;
  }
  // frameId is the Chrome frame the work came from; 0 is the top document.
  schedule(tabId, navigation, lane, operation, frameId = 0) {
    return new Promise((resolve, reject) => {
      if (!this.tabs.has(tabId)) this.tabs.set(tabId, /* @__PURE__ */ new Map());
      const navigations = this.tabs.get(tabId);
      if (!navigations.has(navigation)) {
        navigations.set(navigation, { size: 0, lanes: /* @__PURE__ */ new Map(), frames: /* @__PURE__ */ new Map() });
      }
      const queue = navigations.get(navigation);
      if (frameId !== 0 && !queue.frames.has(frameId)) queue.frames.set(frameId, /* @__PURE__ */ new Map());
      const lanes = frameId !== 0 ? queue.frames.get(frameId) : queue.lanes;
      if (!lanes.has(lane)) lanes.set(lane, new Queue());
      lanes.get(lane).push({
        tabId,
        navigation,
        frameId,
        sequence: this.sequence++,
        operation,
        resolve,
        reject
      });
      queue.size += 1;
      this.size += 1;
      void this.drain();
    });
  }
  // Releases the queued work of the tab's navigations that are no longer live.
  discardStale(tabId) {
    const navigations = this.tabs.get(tabId);
    if (!navigations) return;
    for (const [navigation, queue] of navigations) {
      if (this.isLive(tabId, navigation)) continue;
      navigations.delete(navigation);
      this.size -= queue.size;
      for (const lanes of [queue.lanes, ...queue.frames.values()]) {
        for (const tasks of lanes.values()) {
          for (const task of tasks) task.resolve({ stale: true });
        }
      }
      for (const frameId of queue.frames.keys()) this.forgetFrame(tabId, frameId);
    }
    if (navigations.size === 0) this.tabs.delete(tabId);
  }
  removeTab(tabId) {
    this.discardStale(tabId);
    this.laneCursors.delete(tabId);
    this.frameCursors.delete(tabId);
    this.frameLaneCursors.delete(tabId);
  }
  async drain() {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      if (this.viewpointKnown) {
        await this.viewpointKnown;
        this.viewpointKnown = void 0;
      }
      while (this.size > 0) {
        const task = this.takeNext();
        if (!this.isLive(task.tabId, task.navigation)) {
          task.resolve({ stale: true });
          continue;
        }
        try {
          task.resolve(await task.operation());
        } catch (error) {
          task.reject(error);
        }
      }
    } finally {
      this.running = false;
      if (this.size > 0) {
        void this.drain();
      }
    }
  }
  // The viewpoint tab's shown work comes first, and while background work
  // waits, one background task runs after every VIEWPOINT_TURNS viewpoint
  // tasks. Background tabs take turns in tab ID order, one task each.
  takeNext() {
    const viewpointQueues = this.queuesOf(this.viewpointTabId, true);
    const viewpointSize = viewpointQueues.reduce((size, queue) => size + queue.size, 0);
    const backgroundWaits = this.size > viewpointSize;
    let selectedTabId;
    let queues;
    if (viewpointSize > 0 && !(backgroundWaits && this.viewpointTurns >= VIEWPOINT_TURNS)) {
      this.viewpointTurns = backgroundWaits ? this.viewpointTurns + 1 : 0;
      selectedTabId = this.viewpointTabId;
      queues = viewpointQueues;
    } else {
      this.viewpointTurns = 0;
      let first;
      for (const tabId of this.tabs.keys()) {
        if (tabId === this.viewpointTabId && this.queuesOf(tabId, false).length === 0) continue;
        if (first === void 0 || tabId < first) first = tabId;
        if (tabId > this.lastTabId && (selectedTabId === void 0 || tabId < selectedTabId)) {
          selectedTabId = tabId;
        }
      }
      selectedTabId ??= first;
      this.lastTabId = selectedTabId;
      queues = this.queuesOf(selectedTabId, false);
    }
    return this.takeFromLanes(
      queues.map((queue) => ({ queue, lanes: queue.lanes })),
      URGENT_LANES,
      this.laneCursors,
      selectedTabId,
      () => this.takeFromFrames(selectedTabId, queues)
    );
  }
  // Takes the next task of a document's lanes (groups: each of its
  // navigations' lanes): its urgent lanes in order, then the other lanes in
  // turn from the lane after the one served last (cursors.get(key)), the
  // frame lane served by takeFrames, then a lane outside both classes.
  takeFromLanes(groups, urgentLanes, cursors, key, takeFrames) {
    for (const lane of urgentLanes) {
      const task = this.takeFromLane(groups, lane);
      if (task) return task;
    }
    const cursor = cursors.get(key) || 0;
    for (let offset = 0; offset < SCAN_LANES.length; offset += 1) {
      const laneIndex = (cursor + offset) % SCAN_LANES.length;
      const lane = SCAN_LANES[laneIndex];
      const task = lane === FRAME_LANE ? takeFrames?.() : this.takeFromLane(groups, lane);
      if (task) {
        cursors.set(key, (laneIndex + 1) % SCAN_LANES.length);
        return task;
      }
    }
    return this.takeFromLane(groups);
  }
  // The queues of the tab's navigations that are the viewpoint's work (its
  // shown documents in the viewpoint tab), or else background work.
  queuesOf(tabId, viewpoint) {
    const queues = [];
    for (const [navigation, queue] of this.tabs.get(tabId) ?? []) {
      if ((tabId === this.viewpointTabId && this.isShown(tabId, navigation)) === viewpoint) {
        queues.push(queue);
      }
    }
    return queues;
  }
  // Takes the earliest task of the lane, or of any lane, among the groups.
  takeFromLane(groups, lane) {
    let earliest;
    for (const group of groups) {
      for (const [key, tasks] of lane === void 0 ? group.lanes : [[lane, group.lanes.get(lane)]]) {
        if (tasks && (!earliest || tasks.first().sequence < earliest.tasks.first().sequence)) {
          earliest = { ...group, key, tasks };
        }
      }
    }
    return earliest && this.take(earliest);
  }
  // Frames take turns in frame ID order, one task each, so one busy frame
  // cannot hold back the others. Within its turn a frame's lanes are served
  // like the top document's, so a frame's queued request bodies or scripts
  // cannot hold back its own document changes.
  takeFromFrames(tabId, queues) {
    const lastFrameId = this.frameCursors.get(tabId) ?? 0;
    let first;
    let next;
    for (const queue of queues) {
      for (const frameId2 of queue.frames.keys()) {
        if (first === void 0 || frameId2 < first) first = frameId2;
        if (frameId2 > lastFrameId && (next === void 0 || frameId2 < next)) next = frameId2;
      }
    }
    const frameId = next ?? first;
    if (frameId === void 0) return void 0;
    this.frameCursors.set(tabId, frameId);
    if (!this.frameLaneCursors.has(tabId)) this.frameLaneCursors.set(tabId, /* @__PURE__ */ new Map());
    return this.takeFromLanes(
      queues.filter((queue) => queue.frames.has(frameId)).map((queue) => ({ queue, lanes: queue.frames.get(frameId), frameId })),
      FRAME_URGENT_LANES,
      this.frameLaneCursors.get(tabId),
      frameId
    );
  }
  take({ queue, lanes, frameId, key, tasks }) {
    const task = tasks.shift();
    if (tasks.length === 0) lanes.delete(key);
    if (lanes.size === 0 && frameId !== void 0) queue.frames.delete(frameId);
    queue.size -= 1;
    this.size -= 1;
    if (queue.size === 0) {
      const navigations = this.tabs.get(task.tabId);
      navigations.delete(task.navigation);
      if (navigations.size === 0) this.tabs.delete(task.tabId);
    }
    if (lanes.size === 0 && frameId !== void 0) this.forgetFrame(task.tabId, frameId);
    return task;
  }
  // Forgets the lane cursor of a frame once none of its tab's work is queued.
  forgetFrame(tabId, frameId) {
    for (const queue of this.tabs.get(tabId)?.values() ?? []) {
      if (queue.frames.has(frameId)) return;
    }
    this.frameLaneCursors.get(tabId)?.delete(frameId);
  }
};
var Queue = class {
  #items = [];
  #head = 0;
  get length() {
    return this.#items.length - this.#head;
  }
  first() {
    return this.#items[this.#head];
  }
  push(...items) {
    this.#items.push(...items);
  }
  shift() {
    const item = this.#items[this.#head];
    this.#items[this.#head] = void 0;
    this.#head += 1;
    if (this.#head * 2 >= this.#items.length) {
      this.#items = this.#items.slice(this.#head);
      this.#head = 0;
    }
    return item;
  }
  *[Symbol.iterator]() {
    for (let index = this.#head; index < this.#items.length; index += 1) {
      yield this.#items[index];
    }
  }
};

// src/bounded-response.js
async function readBoundedResponseText(response, { maxBytes, maxChars } = {}) {
  if (!response.body?.getReader) {
    throw new Error("Response body is not readable");
  }
  if (!Number.isInteger(maxBytes) || maxBytes < 1 || !Number.isInteger(maxChars) || maxChars < 1) {
    throw new Error("Response body limits are invalid");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let text = "";
  let truncated = false;
  let reachedEnd = false;
  try {
    while (!truncated) {
      const { done, value } = await reader.read();
      if (done) {
        reachedEnd = true;
        text += decoder.decode();
        break;
      }
      const remainingBytes = maxBytes - bytesRead;
      if (value.byteLength > remainingBytes) {
        text += decoder.decode(value.subarray(0, remainingBytes));
        truncated = true;
      } else {
        bytesRead += value.byteLength;
        text += decoder.decode(value, { stream: true });
        truncated = text.length > maxChars;
      }
    }
    return {
      text: text.slice(0, maxChars),
      truncated: truncated || text.length > maxChars
    };
  } finally {
    if (!reachedEnd) {
      void reader.cancel().catch(() => {
      });
    }
  }
}

// src/reporting.js
var REPORT_BASE_URL = "https://a-watchtower.adamnetworks.ca";
var REPORT_TIMEOUT_MS = 2e4;
var MAX_RESPONSE_BYTES = 4096;
var PRIVATE_HOST_SUFFIXES = [
  "localhost",
  "local",
  "localdomain",
  "lan",
  "home",
  "home.arpa",
  "internal",
  "intranet",
  "corp",
  "test",
  "example",
  "invalid",
  "nip.io",
  "sslip.io",
  "xip.io",
  "traefik.me",
  "localtest.me",
  "lvh.me"
];
function reportURL(value) {
  const url = new URL(value);
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!["http:", "https:"].includes(url.protocol) || !host.includes(".") || host.includes(":") || /^(?:\d+\.){3}\d+$/.test(host) || PRIVATE_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))) {
    return null;
  }
  url.search = "";
  url.hash = "";
  url.username = "";
  url.password = "";
  return url.href;
}
async function reportDetections({ url: rawURL, matches, matchedAt, extensionVersion }) {
  const url = reportURL(rawURL);
  if (!url) return;
  const ruleIDs = [...new Set(matches.map((match) => match.rule))];
  if (ruleIDs.some((rule) => !/^clicknix_[1-9]\d*$/.test(rule))) {
    throw new Error("Invalid reporting rule ID");
  }
  let failure;
  for (const ruleID of ruleIDs) {
    try {
      await reportRule({ url, ruleID, matchedAt, extensionVersion });
    } catch (error) {
      failure ??= error;
    }
  }
  if (failure) throw failure;
}
async function reportRule({ url, ruleID, matchedAt, extensionVersion }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REPORT_TIMEOUT_MS);
  try {
    const challenge = await requestJSON("/v1/challenge", {}, controller.signal, 200);
    const nonce = await solveChallenge(challenge, controller.signal);
    const body = JSON.stringify({
      schema_version: 1,
      challenge_id: challenge.challenge_id,
      pow_nonce: nonce,
      url,
      rule_id: ruleID,
      matched_at: matchedAt,
      extension_version: extensionVersion
    });
    if (new TextEncoder().encode(body).byteLength > 16384) {
      throw new Error("Report exceeds bsentinel's body limit");
    }
    const result = await requestJSON("/v1/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body
    }, controller.signal, 202);
    if (result.status !== "accepted" || typeof result.report_id !== "string" || !result.report_id) {
      throw new Error("Report was not acknowledged");
    }
  } finally {
    clearTimeout(timer);
  }
}
async function solveChallenge(challenge, signal) {
  if (challenge?.algorithm !== "sha256-leading-zero-bits" || typeof challenge.challenge_id !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(challenge.challenge_id) || typeof challenge.prefix !== "string" || challenge.prefix.length < 1 || challenge.prefix.length > 256 || !Number.isInteger(challenge.difficulty) || challenge.difficulty < 8 || challenge.difficulty > 24) {
    throw new Error("Invalid bsentinel challenge");
  }
  const encoder = new TextEncoder();
  for (let i = 0; ; i += 1) {
    signal.throwIfAborted();
    const nonce = String(i);
    const hash = new Uint8Array(await crypto.subtle.digest(
      "SHA-256",
      encoder.encode(challenge.prefix + nonce)
    ));
    let zeroBits = 0;
    for (const byte of hash) {
      zeroBits += Math.clz32(byte) - 24;
      if (byte !== 0) break;
    }
    if (zeroBits >= challenge.difficulty) {
      signal.throwIfAborted();
      return nonce;
    }
    if (i % 250 === 249) await new Promise((resolve) => setTimeout(resolve, 0));
  }
}
async function requestJSON(path, options, signal, expectedStatus) {
  const response = await fetch(`${REPORT_BASE_URL}${path}`, {
    ...options,
    signal,
    credentials: "omit",
    referrerPolicy: "no-referrer",
    redirect: "error",
    cache: "no-store"
  });
  if (response.status !== expectedStatus) {
    await response.body?.cancel();
    throw new Error(`bsentinel HTTP ${response.status}`);
  }
  const { text, truncated } = await readBoundedResponseText(response, {
    maxBytes: MAX_RESPONSE_BYTES,
    maxChars: MAX_RESPONSE_BYTES
  });
  if (truncated) throw new Error("Oversized bsentinel response");
  return JSON.parse(text);
}

// src/service-worker.js
var TAB_STATE_PREFIX = "tab:";
var WARNING_STATE_PREFIX = "warning:";
var WARNING_ALLOW_PREFIX = "warning-allow:";
var WARNING_DOCUMENTS_PREFIX = "warning-documents:";
var OPENED_TAB_PREFIX = "opened:";
var PICTURE_IN_PICTURE_PREFIX = "pip:";
var NOTIFICATION_PREFIX = "clicknix-tab-";
var WARNING_URL = chrome.runtime.getURL("warning.html");
var SCRIPT_IDLE_TIMEOUT_MS = 8e3;
var URGENT_SCRIPT_PREEMPT_MS = 100;
var MAX_CONCURRENT_EXTERNAL_SCRIPTS = 4;
var MAX_CONCURRENT_URGENT_EXTERNAL_SCRIPTS = 1;
var MAX_REQUEST_URLS_PER_SCAN = 800;
var REQUEST_URL_SCAN_INTERVAL_MS = 20;
var MAX_EVIDENCE = 8;
var BACK_FORWARD_CACHE_SIZE = 6;
var MAX_KEPT_URL_CHARS = 2e3;
var MAX_FRAME_TEXT_DIGESTS = 1024;
var MAX_FRAME_DOCUMENTS = 1024;
var MAX_EXTERNAL_SCRIPTS = 1024;
var TEXT_SCAN_MESSAGES = {
  "scan-document": { lane: "document", resourceType: "Document" },
  "scan-document-change": { lane: "document-change", resourceType: "Document" },
  "scan-response-body": { lane: "page-response" },
  "scan-script": { lane: "inline-script", resourceType: "Script" },
  "scan-popup-document": { lane: "document", resourceType: "Document" }
};
var EMPTY_DOCUMENT_MARKUP = /^(?:<\/?(?:html|head|body)>)*$/;
var CLIPBOARD_COMMAND_KINDS = Object.values(CLIPBOARD_COMMAND);
var tabStateQueues = /* @__PURE__ */ new Map();
var pictureInPictureWindows = /* @__PURE__ */ new Map();
var pictureInPictureRestored = restoreTabEntries(
  PICTURE_IN_PICTURE_PREFIX,
  pictureInPictureWindows
);
var tabDocuments = /* @__PURE__ */ new Map();
var tabPendingRequests = /* @__PURE__ */ new Map();
var cachedDocuments = /* @__PURE__ */ new Map();
var tabWarningRequests = /* @__PURE__ */ new Map();
var openedTabs = /* @__PURE__ */ new Map();
var openedTabsRestored = restoreTabEntries(OPENED_TAB_PREFIX, openedTabs);
var externalScriptPools = {
  normal: { active: 0, limit: MAX_CONCURRENT_EXTERNAL_SCRIPTS, waiters: [] },
  urgent: { active: 0, limit: MAX_CONCURRENT_URGENT_EXTERNAL_SCRIPTS, waiters: [] },
  background: { active: 0, limit: MAX_CONCURRENT_EXTERNAL_SCRIPTS, waiters: [] }
};
var URGENT_SCRIPT_PREEMPTION = /* @__PURE__ */ Symbol("urgent-script-preemption");
var activeUrgentScriptAcquisition;
var viewpointTabId;
var viewpointQuery;
var HTTP_REQUEST_FILTER = {
  urls: ["http://*/*", "https://*/*"]
};
var viewpointKnown = refreshViewpointTab().catch(() => {
});
var scanScheduler = new ScanScheduler(isLiveNavigation, {
  isShown: isShownNavigation,
  viewpointKnown
});
var ResultHandlingError = class extends Error {
  constructor(error) {
    super(errorMessage(error));
    this.name = "ResultHandlingError";
  }
};
void initializeScannerRuntime().catch(() => {
});
chrome.tabs.onActivated.addListener(() => {
  void refreshViewpointTab().catch(() => {
  });
});
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  void refreshViewpointTab().catch(() => {
  });
});
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    void handleNetworkRequest(details).catch(() => {
    });
  },
  HTTP_REQUEST_FILTER,
  ["requestBody"]
);
chrome.webRequest.onErrorOccurred.addListener(
  (details) => {
    if (details.frameId !== 0) return;
    abandonTopLevelRequest(details.tabId, (pending) => pending.requestId === details.requestId);
  },
  { ...HTTP_REQUEST_FILTER, types: ["main_frame"] }
);
chrome.webNavigation.onErrorOccurred.addListener((details) => {
  if (details.frameId !== 0) return;
  abandonTopLevelRequest(details.tabId, (pending) => sameURLWithoutFragment(pending.requestURL, details.url));
});
chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0 || details.documentLifecycle !== "active") return;
  if (details.url === WARNING_URL) {
    commitWarningPage(details.tabId);
    return;
  }
  const navigation = commitTopLevelDocument(details);
  navigation.rescanOnComplete = details.transitionQualifiers?.includes("forward_back") === true;
  void chrome.tabs.sendMessage(details.tabId, { type: "start-document" }).catch(() => {
  });
  if (isHTTPURL(details.url) && navigation.scannedURL !== details.url) {
    void scanNavigationURL(details.tabId, navigation, details.url).catch(() => {
    });
  }
  void scanFrameURLs(details.tabId, navigation).catch(() => {
  });
});
chrome.webNavigation.onCreatedNavigationTarget.addListener(({ sourceTabId, tabId, url }) => {
  const opened = { sourceTabId, urlKey: popupURLKey(url) };
  openedTabs.set(tabId, opened);
  void opened.urlKey.then((urlKey) => {
    if (openedTabs.get(tabId) !== opened) return;
    return storeSession({ [`${OPENED_TAB_PREFIX}${tabId}`]: { sourceTabId, urlKey } });
  });
});
async function restoreTabEntries(prefix, entries) {
  const items = await chrome.storage.session.get(null).catch(() => ({}));
  for (const [key, value] of Object.entries(items)) {
    if (!key.startsWith(prefix)) continue;
    const tabId = Number(key.slice(prefix.length));
    if (!entries.has(tabId)) entries.set(tabId, value);
  }
}
chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.frameId !== 0) return;
  const navigation = tabDocuments.get(details.tabId);
  if (navigation?.documentId !== details.documentId || !navigation.rescanOnComplete) return;
  navigation.rescanOnComplete = false;
  void requestRescan(details.tabId, details.documentId).catch(() => {
  });
});
for (const event of [
  chrome.webNavigation.onHistoryStateUpdated,
  chrome.webNavigation.onReferenceFragmentUpdated
]) {
  event.addListener((details) => {
    void updateSameDocumentURL(details).then((navigation) => navigation && scanNavigationURL(details.tabId, navigation, details.url)).catch(() => {
    });
  });
}
async function updateSameDocumentURL(details) {
  if (details.frameId !== 0 || details.documentLifecycle !== "active" || !isHTTPURL(details.url)) return null;
  const navigation = await navigationForDocument(details.tabId, details.documentId);
  if (!navigation) return null;
  navigation.pageURL = details.url;
  navigation.documentURL = details.url;
  return navigation;
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const messageType = message?.type;
  if (messageType === "get-scanner-status") {
    void getScannerStatus().then((scannerStatus) => sendResponse({
      scannerStatus,
      ...Number.isInteger(message.tabId) ? { scanning: isScanning(message.tabId) } : {}
    })).catch((error) => sendResponse({
      scannerStatus: {
        state: "failed",
        error: errorMessage(error)
      }
    }));
    return true;
  }
  if (messageType === "continue-warning") {
    void continueFromWarning(sender).then(sendResponse).catch((error) => sendResponse({ ok: false, error: errorMessage(error) }));
    return true;
  }
  if (messageType === CLIPBOARD_NOTICE_MESSAGE) {
    void relayClipboardNotice(message, sender).catch(() => {
    });
    return false;
  }
  let handler;
  if (messageType === "scan-script-url") {
    handler = handleExternalScriptScan;
  } else if (messageType === "scan-popup-document") {
    handler = handlePopupDocumentScan;
  } else if (Object.hasOwn(TEXT_SCAN_MESSAGES, messageType)) {
    handler = handleTextScan;
  } else {
    return false;
  }
  void pictureInPictureRestored.then(() => handleScanMessage(handler, message, pageSender(message, sender))).then(sendResponse).catch((error) => {
    sendResponse({ ok: false, error: errorMessage(error) });
  });
  return true;
});
chrome.tabs.onRemoved.addListener((tabId) => {
  void pictureInPictureRestored.then(() => pictureInPictureWindows.delete(tabId));
  void openedTabsRestored.then(() => openedTabs.delete(tabId));
  tabDocuments.get(tabId)?.controller.abort();
  tabDocuments.delete(tabId);
  tabPendingRequests.delete(tabId);
  tabWarningRequests.delete(tabId);
  for (const navigation of cachedDocuments.get(tabId)?.values() ?? []) navigation.controller.abort();
  cachedDocuments.delete(tabId);
  scanScheduler.removeTab(tabId);
  void queueTabStateUpdate(tabId, async () => {
    await chrome.storage.session.remove([
      `${TAB_STATE_PREFIX}${tabId}`,
      `${WARNING_STATE_PREFIX}${tabId}`,
      `${WARNING_ALLOW_PREFIX}${tabId}`,
      `${WARNING_DOCUMENTS_PREFIX}${tabId}`,
      `${OPENED_TAB_PREFIX}${tabId}`,
      `${PICTURE_IN_PICTURE_PREFIX}${tabId}`
    ]);
    await chrome.notifications.clear(`${NOTIFICATION_PREFIX}${tabId}`);
  }).catch(() => {
  });
});
async function relayClipboardNotice(message, sender) {
  if (!Number.isInteger(sender.tab?.id) || !CLIPBOARD_COMMAND_KINDS.includes(message.kind)) return;
  await chrome.tabs.sendMessage(
    sender.tab.id,
    { type: CLIPBOARD_NOTICE_MESSAGE, kind: message.kind },
    { frameId: 0 }
  ).catch(() => {
  });
}
function pageSender(message, sender) {
  const tab = sender.tab;
  if (message.pictureInPicture === true && sender.frameId === 0 && Number.isInteger(tab?.openerTabId) && pictureInPictureOpener(tab.id) !== tab.openerTabId) {
    setPictureInPictureWindow(tab.id, { openerTabId: tab.openerTabId });
  }
  const openerTabId = pictureInPictureOpener(tab?.id);
  return openerTabId === void 0 ? sender : { ...sender, tab: { ...tab, id: openerTabId }, pictureInPictureTabId: tab.id };
}
function pictureInPictureOpener(tabId) {
  return pictureInPictureWindows.get(tabId)?.openerTabId;
}
function setPictureInPictureWindow(tabId, pictureInPicture) {
  pictureInPictureWindows.set(tabId, pictureInPicture);
  void storeSession({ [`${PICTURE_IN_PICTURE_PREFIX}${tabId}`]: pictureInPicture });
}
async function handleScanMessage(handler, message, sender) {
  const navigation = await navigationForSender(sender);
  if (!navigation) {
    return { ok: true, result: { stale: true } };
  }
  const tabId = sender.tab.id;
  try {
    const result = await handler(message, sender, navigation);
    return { ok: true, result };
  } catch (error) {
    await handleScanError(tabId, navigation, message.type, message.url, error);
    return { ok: false, error: errorMessage(error) };
  }
}
async function handleScanError(tabId, navigation, source, url, error) {
  if (error instanceof ResultHandlingError) {
    return;
  }
  try {
    await recordScanFailure(tabId, navigation, error, { resourceURL: url, source });
  } catch {
  }
}
async function handleTextScan(message, sender, navigation) {
  if (typeof message.payload !== "string" || message.payload.length === 0) {
    throw new Error(`${message.type} payload is empty`);
  }
  const tabId = sender.tab.id;
  const { lane, resourceType } = TEXT_SCAN_MESSAGES[message.type];
  if (sender.frameId !== 0) {
    if (EMPTY_DOCUMENT_MARKUP.test(message.payload)) return { empty: true };
    if (!await claimFrameText(navigation, message.payload)) return { alreadyScanned: true };
  }
  return scheduleTabScan(tabId, navigation, lane, sender.frameId, async () => {
    const result = await scanText(message.payload);
    return recordMatches(tabId, navigation, result, {
      resourceURL: typeof message.url === "string" ? message.url : navigation.pageURL,
      resourceType: resourceType || message.resourceType || "Other",
      source: lane,
      frameId: sender.frameId,
      frameURL: sender.url
    });
  });
}
async function handlePopupDocumentScan(message, sender, navigation) {
  await openedTabsRestored;
  const urlKey = await popupURLKey(message.url);
  const popupTabIds = [];
  for (const [tabId, opened] of openedTabs) {
    if (opened.sourceTabId === sender.tab.id && urlKey !== void 0 && await opened.urlKey === urlKey) {
      popupTabIds.push(tabId);
    }
  }
  if (popupTabIds.length === 0) return handleTextScan(message, sender, navigation);
  const results = await Promise.all(popupTabIds.map(async (tabId) => {
    const popupNavigation = await initialDocumentNavigation(tabId, navigation);
    const popupSender = { ...sender, tab: { id: tabId }, frameId: 0, url: "about:blank" };
    return popupNavigation ? handleTextScan(message, popupSender, popupNavigation) : { stale: true };
  }));
  return results.find((result) => !result.stale) ?? results[0];
}
async function initialDocumentNavigation(tabId, openerNavigation) {
  if (!await tabOwner(tabId)) {
    tabDocuments.set(tabId, createNavigation({
      documentURL: "about:blank",
      pageURL: openerNavigation.pageURL
    }));
  }
  const navigation = tabDocuments.get(tabId);
  return navigation.documentId === void 0 ? navigation : null;
}
async function claimFrameText(navigation, text) {
  const key = await sha256Hex(text);
  const digests = navigation.frameTextDigests;
  if (digests.has(key)) return false;
  if (digests.size === MAX_FRAME_TEXT_DIGESTS) digests.delete(digests.values().next().value);
  digests.add(key);
  return true;
}
async function popupURLKey(url) {
  const href = urlWithoutFragment(url);
  return href === void 0 ? void 0 : sha256Hex(href);
}
async function sha256Hex(text) {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
  );
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function handleExternalScriptScan(message, sender, navigation) {
  const tabId = sender.tab.id;
  const urgent = message.urgent === true;
  const frame = { frameId: sender.frameId, frameURL: sender.url };
  const fallback = encodingName(message.encoding) ?? "utf-8";
  if (typeof message.url === "string" && message.url.slice(0, 5).toLowerCase() === "data:") {
    return withExternalScriptSlot(tabId, navigation, urgent, (slot) => scanDataScript(tabId, navigation, message.url, fallback, slot, frame));
  }
  let scriptURL;
  try {
    scriptURL = normalizeScriptURL(message.url);
  } catch (error) {
    return unavailableResource(message.url, error.message);
  }
  return scanExternalScriptOnce(tabId, navigation, scriptURL, { urgent, fallback, ...frame });
}
async function scanDataScript(tabId, navigation, url, fallback, slot, { frameId, frameURL }) {
  if (!isLiveNavigation(tabId, navigation)) {
    return { stale: true };
  }
  let lastResult;
  let firstError;
  let decoded = false;
  for (const { layer, text } of dataScriptWindows(url, fallback)) {
    decoded = true;
    await slot.keep();
    try {
      lastResult = await scheduleTabScan(tabId, navigation, "data-script", frameId, async () => {
        const result = await scanText(text);
        return recordMatches(tabId, navigation, result, {
          resourceURL: `data:#layer-${layer}`,
          resourceType: "Script",
          source: "data-script",
          frameId,
          frameURL
        });
      });
    } catch (error) {
      firstError ??= error;
      continue;
    }
    if (lastResult?.stale) {
      return lastResult;
    }
  }
  if (firstError) {
    throw firstError;
  }
  if (!decoded) {
    return unavailableResource(url, "data script could not be decoded");
  }
  return lastResult;
}
async function scanExternalScriptOnce(tabId, navigation, url, options) {
  const key = await sha256Hex(url);
  const scripts = navigation.externalScripts;
  const idle = navigation.idleExternalScripts;
  let entry = scripts.get(key);
  if (!entry) {
    entry = { scans: /* @__PURE__ */ new Map(), reporters: 0 };
    scripts.set(key, entry);
  }
  entry.reporters++;
  idle.delete(key);
  for (const idleKey of idle) {
    if (scripts.size <= MAX_EXTERNAL_SCRIPTS) break;
    idle.delete(idleKey);
    scripts.delete(idleKey);
  }
  try {
    return await scanExternalScriptEntry(tabId, navigation, url, options, entry.scans);
  } finally {
    if (--entry.reporters === 0) idle.add(key);
  }
}
async function scanExternalScriptEntry(tabId, navigation, url, options, scans) {
  const { fallback } = options;
  const scanned = () => [...scans].some(([scannedFallback, { body }]) => scannedFallback === fallback || body && decodesAlike(body, scannedFallback, fallback));
  if (scans.has(fallback)) return { alreadyScanned: true };
  await Promise.all([...scans.values()].map(({ done }) => done));
  if (scanned()) return { alreadyScanned: true };
  return withExternalScriptSlot(tabId, navigation, options.urgent, async (slot) => {
    if (!isLiveNavigation(tabId, navigation)) return { stale: true };
    if (scanned()) return { alreadyScanned: true };
    let finish;
    const scan = {
      done: new Promise((resolve) => {
        finish = resolve;
      }),
      body: void 0
    };
    scans.set(fallback, scan);
    try {
      const { body, ...result } = await scanExternalScript(tabId, navigation, url, slot, options);
      if (result.preempted || result.resourceUnavailable) scans.delete(fallback);
      scan.body = body;
      return result;
    } catch (error) {
      scans.delete(fallback);
      throw error;
    } finally {
      finish();
    }
  });
}
function withExternalScriptSlot(tabId, navigation, urgent, operation) {
  return trackWork(navigation, () => holdExternalScriptSlot(tabId, navigation, urgent, operation));
}
async function holdExternalScriptSlot(tabId, navigation, urgent, operation) {
  await viewpointKnown;
  const waiter = { tabId, navigation };
  let pool = !isViewpointNavigation(tabId, navigation) ? externalScriptPools.background : externalScriptPools[urgent ? "urgent" : "normal"];
  if (pool === externalScriptPools.urgent) {
    await acquireUrgentExternalScriptSlot(pool);
  } else {
    pool = await acquireExternalScriptSlot(pool, waiter);
  }
  const slot = {
    get urgent() {
      return pool === externalScriptPools.urgent;
    },
    async keep() {
      if (pool === externalScriptPools.background || isViewpointNavigation(tabId, navigation)) {
        return;
      }
      if (slot.urgent) activeUrgentScriptAcquisition = void 0;
      releaseExternalScriptSlot(pool);
      pool = await acquireExternalScriptSlot(externalScriptPools.background, waiter);
    }
  };
  try {
    return await operation(slot);
  } finally {
    releaseExternalScriptSlot(pool);
  }
}
function isViewpointNavigation(tabId, navigation) {
  return tabId === viewpointTabId && isShownNavigation(tabId, navigation);
}
async function acquireUrgentExternalScriptSlot(pool) {
  while (pool.active >= pool.limit) {
    const acquisition = activeUrgentScriptAcquisition;
    if (!acquisition) {
      await acquireExternalScriptSlot(pool);
      return;
    }
    const stalledFor = acquisition.stalledSince === void 0 ? 0 : Date.now() - acquisition.stalledSince;
    if (stalledFor < URGENT_SCRIPT_PREEMPT_MS) {
      await new Promise((resolve) => setTimeout(resolve, URGENT_SCRIPT_PREEMPT_MS - stalledFor));
      continue;
    }
    acquisition.controller.abort(URGENT_SCRIPT_PREEMPTION);
    await acquireExternalScriptSlot(pool);
    return;
  }
  await acquireExternalScriptSlot(pool);
}
function acquireExternalScriptSlot(pool, waiter = {}) {
  if (pool.active < pool.limit) {
    pool.active += 1;
    return Promise.resolve(pool);
  }
  return new Promise((resolve) => pool.waiters.push({ ...waiter, resolve }));
}
function releaseExternalScriptSlot(pool) {
  const next = pool.waiters.shift();
  if (next) {
    next.resolve(pool);
  } else {
    pool.active -= 1;
  }
}
function followViewpoint() {
  const { normal, background } = externalScriptPools;
  const viewpoint = ({ tabId, navigation }) => isViewpointNavigation(tabId, navigation);
  moveExternalScriptWaiters(normal, background, (waiter) => !viewpoint(waiter));
  moveExternalScriptWaiters(background, normal, viewpoint);
}
function moveExternalScriptWaiters(from, to, moves) {
  const staying = [];
  for (const waiter of from.waiters) {
    if (!moves(waiter)) {
      staying.push(waiter);
    } else if (to.active < to.limit) {
      to.active += 1;
      waiter.resolve(to);
    } else {
      to.waiters.push(waiter);
    }
  }
  from.waiters = staying;
}
async function scanExternalScript(tabId, navigation, url, slot, { fallback, frameId, frameURL }) {
  const controller = new AbortController();
  const acquisition = slot.urgent ? { controller, stalledSince: void 0 } : null;
  if (acquisition) activeUrgentScriptAcquisition = acquisition;
  const abortForNavigation = () => controller.abort();
  const navigationSignal = navigation.controller.signal;
  if (navigationSignal.aborted) {
    controller.abort();
  } else {
    navigationSignal.addEventListener("abort", abortForNavigation, { once: true });
  }
  const awaitData = async (read) => {
    await slot.keep();
    const promise = read();
    if (acquisition) acquisition.stalledSince = Date.now();
    const timer = setTimeout(() => {
      controller.abort(new Error(`No data for ${SCRIPT_IDLE_TIMEOUT_MS / 1e3} seconds`));
    }, SCRIPT_IDLE_TIMEOUT_MS);
    try {
      return await promise;
    } finally {
      clearTimeout(timer);
      if (acquisition) acquisition.stalledSince = void 0;
    }
  };
  let finalURL = url;
  const unavailable = (error) => {
    if (controller.signal.reason === URGENT_SCRIPT_PREEMPTION) {
      return { preempted: true, url: finalURL };
    }
    if (!isLiveNavigation(tabId, navigation)) {
      return { stale: true };
    }
    return unavailableResource(finalURL, error instanceof Error ? error.message : String(error));
  };
  try {
    let response;
    try {
      response = await awaitData(() => fetch(url, {
        cache: "no-store",
        credentials: "omit",
        signal: controller.signal
      }));
    } catch (error) {
      return unavailable(error);
    }
    finalURL = response.url || url;
    if (!isLiveNavigation(tabId, navigation)) {
      return { stale: true };
    }
    if (!response.ok) {
      return unavailableResource(finalURL, `HTTP ${response.status}`);
    }
    if (!response.body) {
      return { empty: true, url: finalURL };
    }
    const reader = response.body.getReader();
    const readChunk = async () => {
      const { done, value } = await awaitData(() => reader.read());
      return done ? null : value;
    };
    const windows = scriptTextWindows(
      readChunk,
      contentTypeCharset(response.headers.get("content-type")),
      fallback
    );
    let result = { empty: true, url: finalURL };
    for (; ; ) {
      let next;
      try {
        next = await windows.next();
      } catch (error) {
        return unavailable(error);
      }
      if (next.done) return { ...result, body: next.value };
      const text = next.value;
      await slot.keep();
      result = await scheduleTabScan(tabId, navigation, "external-script", frameId, async () => {
        const scanResult = await scanText(text);
        return recordMatches(tabId, navigation, scanResult, {
          resourceURL: finalURL,
          resourceType: "Script",
          source: "external-script",
          frameId,
          frameURL
        });
      });
      if (result?.stale) return result;
    }
  } finally {
    if (activeUrgentScriptAcquisition === acquisition) {
      activeUrgentScriptAcquisition = void 0;
    }
    navigationSignal.removeEventListener("abort", abortForNavigation);
    controller.abort();
  }
}
function unavailableResource(url, reason) {
  return {
    resourceUnavailable: true,
    url: boundedURL(url),
    reason: String(reason).slice(0, 500)
  };
}
function boundedURL(url) {
  if (typeof url !== "string") return void 0;
  return url.length > MAX_KEPT_URL_CHARS ? structuredClone(url.slice(0, MAX_KEPT_URL_CHARS)) : url;
}
function normalizeScriptURL(value) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("External script URL is missing");
  }
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error(`External script URL uses unsupported scheme ${url.protocol}`);
    }
    url.hash = "";
    return url.href;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("External script URL uses")) {
      throw error;
    }
    throw new Error("External script URL is invalid");
  }
}
async function handleNetworkRequest(tabDetails) {
  if (!Number.isInteger(tabDetails.tabId) || tabDetails.tabId < 0) {
    return;
  }
  await pictureInPictureRestored;
  const openerTabId = pictureInPictureOpener(tabDetails.tabId);
  const details = openerTabId === void 0 ? tabDetails : { ...tabDetails, tabId: openerTabId };
  const requestBody = requestBodyChunks(details.requestBody);
  if (details.type === "main_frame") {
    if (details.frameId !== 0) {
      return;
    }
    const navigation = beginTopLevelRequest(details);
    return scanNetworkRequest(details, { navigation, frameId: 0, frameURL: details.url }, requestBody);
  }
  const frameNavigation = details.type === "sub_frame" || details.type === "object" && details.documentId === void 0;
  const documentId = frameNavigation ? details.parentDocumentId : details.documentId;
  if (details.documentLifecycle !== "active" || !documentId) {
    return;
  }
  const issuer = await resolveDocument(
    details.tabId,
    documentId,
    frameNavigation ? void 0 : details.initiator
  );
  if (!issuer) return;
  const source = {
    navigation: issuer.navigation,
    frameId: details.frameId,
    frameURL: frameNavigation ? details.url : issuer.frameURL,
    frameNavigation
  };
  return scanNetworkRequest(details, source, requestBody);
}
async function scanNetworkRequest(details, source, requestBody) {
  const { navigation, frameId, frameURL } = source;
  if (!isLiveNavigation(details.tabId, navigation)) {
    return { stale: true };
  }
  if (details.type === "main_frame") {
    navigation.scannedURL = details.url;
    await scanPageURL(details.tabId, navigation, details.url);
  } else if (source.frameNavigation) {
    await scanPageURL(details.tabId, navigation, details.url, frameId);
  } else {
    queueRequestURL(details.tabId, navigation, details.url, frameId, frameURL);
    if (details.type === "script") {
      await scanRequestedScript(details.tabId, navigation, normalizeScriptURL(details.url), {
        frameId,
        frameURL
      });
    }
  }
  if (!requestBody) {
    return;
  }
  for (const bytes of byteWindows(requestBody)) {
    const scan = await scheduleTabScan(details.tabId, navigation, "request-body", frameId, async () => {
      let bodyResult;
      try {
        bodyResult = await scanBytes(bytes);
      } catch (error) {
        await recordScanFailure(details.tabId, navigation, error, {
          resourceURL: details.url,
          source: "request-body"
        });
      }
      if (bodyResult) {
        try {
          await recordMatches(details.tabId, navigation, bodyResult, {
            resourceURL: details.url,
            resourceType: details.type || "Other",
            source: "request-body",
            frameId,
            frameURL
          });
        } catch {
        }
      }
    });
    if (scan?.stale) return scan;
  }
  return { scanned: true };
}
function queueRequestURL(tabId, navigation, url, frameId, frameURL) {
  const requests = navigation.requestURLs;
  if (requests.seen.has(url)) return;
  if (requests.seenChars + url.length > MAX_CAPTURE_CHARS) {
    requests.seen.clear();
    requests.seenChars = 0;
  }
  requests.seen.add(url);
  requests.seenChars += url.length;
  requests.queued.push(url, frameId, frameURL);
  if (!requests.scheduled) scheduleRequestURLs(tabId, navigation);
}
function scheduleRequestURLs(tabId, navigation) {
  navigation.requestURLs.scheduled = true;
  void scheduleTabScan(tabId, navigation, "request-url", 0, () => scanRequestURLs(tabId, navigation)).catch((error) => handleScanError(tabId, navigation, "request-url", navigation.pageURL, error));
}
async function scanRequestURLs(tabId, navigation) {
  const requests = navigation.requestURLs;
  const contexts = [];
  let length = 0;
  while (requests.queued.length > 0 && contexts.length < MAX_REQUEST_URLS_PER_SCAN) {
    const url = requests.queued.first();
    if (contexts.length > 0 && length + url.length > MAX_SCAN_BYTES) break;
    length += url.length;
    contexts.push({
      resourceURL: requests.queued.shift(),
      resourceType: "Other",
      source: "request-url",
      frameId: requests.queued.shift(),
      frameURL: requests.queued.shift()
    });
  }
  if (requests.queued.length > 0) {
    scheduleRequestURLs(tabId, navigation);
  } else {
    setTimeout(() => {
      if (requests.queued.length > 0) {
        scheduleRequestURLs(tabId, navigation);
      } else {
        requests.scheduled = false;
      }
    }, REQUEST_URL_SCAN_INTERVAL_MS);
  }
  const encoder = new TextEncoder();
  const results = await scanBatch(contexts.map((context) => encoder.encode(context.resourceURL)));
  const failed = results.findIndex((result) => result.error);
  if (failed !== -1) {
    await recordScanFailure(tabId, navigation, results[failed].error, contexts[failed]);
  }
  const scanned = results.filter((result) => !result.error);
  if (scanned.length === 0) return;
  const page = {
    resourceURL: navigation.pageURL,
    resourceType: "Other",
    source: "request-url",
    frameId: 0,
    frameURL: navigation.documentURL
  };
  const matched = contexts.filter((_context, index) => results[index].matches?.length > 0);
  return recordMatches(tabId, navigation, {
    rulesVersion: scanned[0].rulesVersion,
    matches: scanned.flatMap((result) => result.matches),
    warnings: scanned.flatMap((result) => result.warnings)
  }, page, matched.length > 0 ? matched : [page]);
}
async function scanRequestedScript(tabId, navigation, url, frame) {
  try {
    await scanExternalScriptOnce(tabId, navigation, url, {
      urgent: false,
      fallback: "utf-8",
      ...frame
    });
  } catch (error) {
    await handleScanError(tabId, navigation, "external-script", url, error);
  }
}
async function scanPageURL(tabId, navigation, url, frameId = 0) {
  const source = frameId === 0 ? "top-level-url" : "frame-url";
  if (frameId !== 0 && !await claimFrameText(navigation, url)) return;
  return scheduleTabScan(tabId, navigation, source, frameId, async () => {
    let urlResult;
    try {
      urlResult = await scanText(url);
    } catch (error) {
      await recordScanFailure(tabId, navigation, error, {
        resourceURL: url,
        source
      });
    }
    if (!urlResult) return;
    try {
      await recordMatches(tabId, navigation, urlResult, {
        resourceURL: url,
        resourceType: frameId === 0 ? "main_frame" : "sub_frame",
        source,
        frameId,
        frameURL: url
      });
    } catch {
    }
  });
}
function refreshViewpointTab() {
  const query = Promise.all([
    chrome.tabs.query({ active: true, lastFocusedWindow: true }),
    pictureInPictureRestored
  ]).then(([[tab]]) => {
    if (query !== viewpointQuery) return viewpointQuery;
    viewpointTabId = pictureInPictureOpener(tab?.id) ?? tab?.id;
    scanScheduler.setViewpointTab(viewpointTabId);
    followViewpoint();
  });
  viewpointQuery = query;
  return query;
}
async function requestRescan(tabId, documentId) {
  const navigation = await navigationForDocument(tabId, documentId);
  if (!navigation) return;
  await pictureInPictureRestored;
  const windows = [...pictureInPictureWindows].filter(([, { openerTabId }]) => openerTabId === tabId);
  await Promise.all([tabId, ...windows.map(([windowTabId]) => windowTabId)].map((id) => chrome.tabs.sendMessage(id, { type: "rescan-document" }).catch(() => {
  })));
  await scanFrameURLs(tabId, navigation);
}
async function scanFrameURLs(tabId, navigation, underId) {
  const frames = underId === void 0 ? await pageFrames(tabId, navigation) : await activeFramesUnder(tabId, (id) => id === underId);
  const children = frames.filter((child) => child.frameId !== 0 && isHTTPURL(child.url));
  await Promise.all(children.map((child) => scanPageURL(tabId, navigation, child.url, child.frameId)));
}
async function scanNavigationURL(tabId, navigation, url) {
  if (tabDocuments.get(tabId) !== navigation) return;
  await scanPageURL(tabId, navigation, url);
}
function createNavigation(fields) {
  return {
    controller: new AbortController(),
    record: null,
    // Child frame documents known to belong to this page, with their URLs
    // (bounded, see boundedURL), the latest MAX_FRAME_DOCUMENTS (see
    // rememberFrameDocument), and every unlisted (blob:) one.
    frameDocuments: /* @__PURE__ */ new Map(),
    unlistedDocuments: /* @__PURE__ */ new Set(),
    // Documents answered stale only because a document they descend from was
    // not resolved yet, the latest MAX_FRAME_DOCUMENTS, each with the ID of
    // that document (see waitForDocument).
    waitingDocuments: /* @__PURE__ */ new Map(),
    // Child-frame text already claimed for scanning, by SHA-256.
    frameTextDigests: /* @__PURE__ */ new Set(),
    // External script scans, done or in progress, for all frames, by the
    // SHA-256 of the URL and by fallback encoding (see scanExternalScriptOnce).
    externalScripts: /* @__PURE__ */ new Map(),
    // Keys of external scripts no report is handling, idle longest first.
    idleExternalScripts: /* @__PURE__ */ new Set(),
    // Subresource request URLs seen, those waiting to be scanned (each with
    // its frame ID and URL) and whether a task will take them.
    requestURLs: { seen: /* @__PURE__ */ new Set(), seenChars: 0, queued: new Queue(), scheduled: false },
    // Work queued or in flight (see trackWork).
    pendingWork: 0,
    ...fields
  };
}
function beginTopLevelRequest({ tabId, requestId, url, timeStamp }) {
  const owner = tabDocuments.get(tabId);
  if (owner && timeStamp <= owner.committedAt) {
    return owner;
  }
  let pending = tabPendingRequests.get(tabId);
  if (pending?.requestId !== requestId) {
    pending = createNavigation({ requestId, pageURL: url });
    tabPendingRequests.set(tabId, pending);
    scanScheduler.discardStale(tabId);
  }
  pending.requestURL = url;
  return pending;
}
function abandonTopLevelRequest(tabId, isAbandoned) {
  const pending = tabPendingRequests.get(tabId);
  if (!pending || !isAbandoned(pending)) return;
  tabPendingRequests.delete(tabId);
  scanScheduler.discardStale(tabId);
}
function commitTopLevelDocument({ tabId, documentId, url, timeStamp }) {
  const owner = tabDocuments.get(tabId);
  if (owner?.documentId === documentId) {
    void queueTabStateUpdate(tabId, () => settleCommittedDocument(tabId, owner, false)).catch(() => {
    });
    return owner;
  }
  const restored = cachedDocuments.get(tabId)?.get(documentId);
  const pending = tabPendingRequests.get(tabId);
  const adopted = !restored && pending && sameURLWithoutFragment(pending.requestURL, url) ? pending : null;
  const navigation = restored || adopted || createNavigation({});
  navigation.committedAt = timeStamp;
  if (!restored) {
    navigation.documentId = documentId;
    navigation.documentURL = url;
    if (isHTTPURL(url)) {
      navigation.pageURL = adopted && !sameURLWithoutFragment(adopted.pageURL, url) ? adopted.pageURL : url;
    } else {
      navigation.pageURL = void 0;
      navigation.creatorURL = owner ? owner.pageURL : storedPageURL(tabId);
    }
  }
  const warned = tabWarningRequests.get(tabId) === navigation;
  tabWarningRequests.delete(tabId);
  replaceTabDocument(tabId, navigation);
  void queueTabStateUpdate(tabId, () => settleCommittedDocument(tabId, navigation, warned)).catch(() => {
  });
  return navigation;
}
function commitWarningPage(tabId) {
  const navigation = tabWarningRequests.get(tabId);
  tabWarningRequests.delete(tabId);
  if (!navigation) return;
  const committed = tabDocuments.get(tabId) === navigation;
  if (!committed) replaceTabDocument(tabId, navigation);
  void queueTabStateUpdate(tabId, async () => {
    if (tabDocuments.get(tabId) !== navigation) return;
    if (!committed) {
      await chrome.storage.session.remove(`${WARNING_ALLOW_PREFIX}${tabId}`);
      await writeNavigationRecord(tabId, navigation, navigation.record);
    }
    await setFlaggedBadge(tabId);
  }).catch(() => {
  });
}
function replaceTabDocument(tabId, navigation) {
  const previous = tabDocuments.get(tabId);
  cachedDocuments.get(tabId)?.delete(navigation.documentId);
  tabDocuments.set(tabId, navigation);
  if (tabPendingRequests.get(tabId) === navigation) tabPendingRequests.delete(tabId);
  if (previous && previous !== navigation) keepCachedDocument(tabId, previous);
  scanScheduler.discardStale(tabId);
  followViewpoint();
}
function keepCachedDocument(tabId, navigation) {
  if (navigation.documentId === void 0) {
    navigation.controller.abort();
    return;
  }
  if (!cachedDocuments.has(tabId)) cachedDocuments.set(tabId, /* @__PURE__ */ new Map());
  const documents = cachedDocuments.get(tabId);
  documents.set(navigation.documentId, navigation);
  if (documents.size <= BACK_FORWARD_CACHE_SIZE) return;
  const [oldest] = documents.values();
  documents.delete(oldest.documentId);
  oldest.controller.abort();
  scanScheduler.discardStale(tabId);
}
async function settleCommittedDocument(tabId, navigation, warned) {
  if (tabDocuments.get(tabId) !== navigation) return;
  if (warned) {
    await writeNavigationRecord(tabId, navigation, navigation.record);
    await flagDocument(tabId, navigation);
    await showWarning(tabId, navigation);
    return;
  }
  const warningKey = `${WARNING_STATE_PREFIX}${tabId}`;
  const allowKey = `${WARNING_ALLOW_PREFIX}${tabId}`;
  const continued = (await chrome.storage.session.get(allowKey))[allowKey];
  let state = await updateWarningDocument(tabId, navigation.documentId);
  if (sameHTTPURLWithoutFragment(continued?.url, navigation.pageURL)) {
    state = await updateWarningDocument(tabId, navigation.documentId, { allowed: true });
  }
  await chrome.storage.session.remove([warningKey, allowKey]);
  if (state?.matches && !navigation.record) {
    navigation.record = void 0;
    navigation.pageURL ??= state.url;
  }
  const record = await readNavigationRecord(tabId, navigation) ?? (state?.matches ? flaggedRecord(navigation, state.matches) : null);
  await writeNavigationRecord(tabId, navigation, record);
  if (record?.matches?.length) {
    void setFlaggedBadge(tabId);
  } else {
    void clearTabPresentation(tabId);
  }
  const unpresented = state?.unpresented === true;
  if (unpresented) await updateWarningDocument(tabId, navigation.documentId, { unpresented: false });
  if (state?.matches && !state.allowed || unpresented) {
    const warningError = await presentMatches(tabId, navigation, unpresented);
    if (warningError) throw warningError;
  }
}
function flaggedRecord(navigation, matches) {
  return {
    url: navigation.pageURL,
    matches,
    evidence: [],
    warnings: [],
    scanned: true,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function updateWarningDocument(tabId, documentId, change) {
  const key = `${WARNING_DOCUMENTS_PREFIX}${tabId}`;
  const entries = (await chrome.storage.session.get(key))[key] ?? [];
  const index = entries.findIndex((entry2) => entry2.documentId === documentId);
  if (index < 0 && !change) return void 0;
  const entry = index < 0 ? { documentId } : entries.splice(index, 1)[0];
  Object.assign(entry, change);
  entries.push(entry);
  await storeSession({ [key]: entries.slice(-(BACK_FORWARD_CACHE_SIZE + 1)) });
  return entry;
}
async function flagDocument(tabId, navigation, change) {
  if (navigation.documentId === void 0) return;
  await updateWarningDocument(tabId, navigation.documentId, {
    url: boundedURL(navigation.pageURL),
    matches: navigation.record?.matches ?? [],
    ...change
  });
}
async function getActiveTopLevelFrame(tabId, expectedDocumentId) {
  const frame = await chrome.webNavigation.getFrame({ tabId, frameId: 0 }).catch(() => null);
  if (!frame || frame.documentLifecycle !== "active" || expectedDocumentId && frame.documentId !== expectedDocumentId) return null;
  return frame;
}
async function navigationForSender(sender) {
  const tabId = sender.tab?.id;
  if (!Number.isInteger(tabId) || sender.documentLifecycle !== "active" || !sender.documentId) return null;
  const windowTabId = sender.pictureInPictureTabId;
  if (windowTabId !== void 0 && sender.frameId === 0) {
    const owner = await navigationForUnlistedDocument(tabId, sender.documentId, sender.origin);
    const pictureInPicture = pictureInPictureWindows.get(windowTabId);
    if (owner && pictureInPicture && pictureInPicture.documentId !== sender.documentId) {
      setPictureInPictureWindow(windowTabId, {
        ...pictureInPicture,
        documentId: sender.documentId,
        ownerDocumentId: owner.documentId
      });
    }
    return owner;
  }
  return (await resolveDocument(tabId, sender.documentId, sender.origin))?.navigation ?? null;
}
async function resolveDocument(tabId, documentId, origin) {
  const navigation = await navigationForDocument(tabId, documentId);
  if (navigation) {
    return await resolveWebDocument(tabId, navigation, origin) ? { navigation, frameURL: navigation.documentURL } : null;
  }
  const owner = await navigationForChildDocument(tabId, documentId, origin);
  if (owner && !owner.pageURL) waitForDocument(tabId, owner, owner.documentId, documentId);
  return owner?.pageURL ? { navigation: owner, frameURL: owner.frameDocuments.get(documentId) } : null;
}
async function navigationForChildDocument(tabId, documentId, origin) {
  await tabOwner(tabId);
  const chain = [];
  let id = documentId;
  for (; ; ) {
    const owner = tabDocuments.get(tabId);
    if (owner && isPageDocument(tabId, owner, id)) {
      for (const [childId, url] of chain) rememberFrameDocument(owner, childId, url);
      return owner;
    }
    const frame = await chrome.webNavigation.getFrame({ documentId: id }).catch(() => null);
    if (!frame) {
      const owner2 = await navigationForUnlistedDocument(
        tabId,
        id,
        id === documentId ? origin : void 0
      );
      if (!owner2) {
        const page = tabDocuments.get(tabId);
        if (id !== documentId) waitForDocument(tabId, page, id, documentId);
        else if (page && !page.pageURL) waitForDocument(tabId, page, page.documentId, documentId);
        return null;
      }
      for (const [childId, url] of chain) rememberFrameDocument(owner2, childId, url);
      return owner2;
    }
    if (frame.documentLifecycle !== "active") return null;
    if (!frame.parentDocumentId) {
      if (!await navigationForDocument(tabId, id)) return null;
      continue;
    }
    chain.push([id, frame.url]);
    id = frame.parentDocumentId;
  }
}
function rememberFrameDocument(navigation, documentId, url) {
  const documents = navigation.frameDocuments;
  documents.set(documentId, boundedURL(url));
  if (documents.size > MAX_FRAME_DOCUMENTS) documents.delete(documents.keys().next().value);
}
function isPageDocument(tabId, owner, documentId) {
  return owner.documentId === documentId || owner.frameDocuments.has(documentId) || owner.unlistedDocuments.has(documentId) || [...pictureInPictureWindows.values()].some((pictureInPicture) => pictureInPicture.openerTabId === tabId && pictureInPicture.documentId === documentId && pictureInPicture.ownerDocumentId === owner.documentId);
}
async function navigationForUnlistedDocument(tabId, documentId, origin) {
  const owner = await tabOwner(tabId);
  if (!owner) return null;
  if (isPageDocument(tabId, owner, documentId)) return owner;
  if (!owner.pageURL || !isHTTPURL(origin)) return null;
  const frames = await pageFrames(tabId, owner);
  if (tabDocuments.get(tabId) !== owner || urlOrigin(owner.pageURL) !== origin && !frames.some((frame) => urlOrigin(frame.url) === origin)) return null;
  owner.unlistedDocuments.add(documentId);
  resumeWaitingDocuments(tabId, owner, documentId);
  return owner;
}
function waitForDocument(tabId, page, waitedId, documentId) {
  if (!page) return;
  const waiting = page.waitingDocuments;
  waiting.delete(documentId);
  waiting.set(documentId, waitedId);
  if (waiting.size > MAX_FRAME_DOCUMENTS) waiting.delete(waiting.keys().next().value);
  if (page.unlistedDocuments.has(waitedId)) resumeWaitingDocuments(tabId, page, waitedId);
}
function resumeWaitingDocuments(tabId, page, resolvedId) {
  for (const [documentId, waitedId] of page.waitingDocuments) {
    if (waitedId !== resolvedId) continue;
    page.waitingDocuments.delete(documentId);
    chrome.tabs.sendMessage(tabId, { type: "resume-document" }, { documentId }).catch(() => {
    });
  }
  void scanFrameURLs(tabId, page, resolvedId).catch(() => {
  });
}
function pageFrames(tabId, navigation) {
  return activeFramesUnder(tabId, (id) => id === navigation.documentId || navigation.unlistedDocuments.has(id));
}
async function activeFramesUnder(tabId, isRoot) {
  const frames = await chrome.webNavigation.getAllFrames({ tabId }).catch(() => null) ?? [];
  const activeFrames = new Map(frames.filter((frame) => frame.documentLifecycle === "active").map((frame) => [frame.documentId, frame]));
  const isUnder = (frame) => {
    for (let id = frame.documentId; id; id = activeFrames.get(id)?.parentDocumentId) {
      if (isRoot(id)) return true;
    }
    return false;
  };
  return [...activeFrames.values()].filter(isUnder);
}
async function tabOwner(tabId) {
  if (!tabDocuments.has(tabId)) {
    const frame = await getActiveTopLevelFrame(tabId);
    if (frame) await navigationForDocument(tabId, frame.documentId);
  }
  return tabDocuments.get(tabId);
}
async function navigationForDocument(tabId, documentId) {
  if (!tabDocuments.has(tabId)) {
    const frame = await getActiveTopLevelFrame(tabId, documentId);
    if (frame && !tabDocuments.has(tabId)) {
      restoreTopLevelDocument(tabId, frame);
    }
  }
  const navigation = tabDocuments.get(tabId);
  return navigation?.documentId === documentId ? navigation : null;
}
function restoreTopLevelDocument(tabId, frame) {
  const web = isHTTPURL(frame.url);
  tabDocuments.set(tabId, createNavigation({
    documentId: frame.documentId,
    documentURL: frame.url,
    pageURL: web ? frame.url : void 0,
    creatorURL: web ? void 0 : storedPageURL(tabId),
    record: void 0
  }));
}
async function storedPageURL(tabId) {
  const stateKey = `${TAB_STATE_PREFIX}${tabId}`;
  const url = (await chrome.storage.session.get(stateKey).catch(() => ({})))[stateKey]?.url;
  return isHTTPURL(url) ? url : void 0;
}
async function resolveWebDocument(tabId, navigation, origin) {
  if (!navigation.pageURL && (origin === "null" || isHTTPURL(origin))) {
    const creatorURL = await navigation.creatorURL ?? await openerPageURL(tabId);
    navigation.pageURL = origin === "null" || urlOrigin(creatorURL) === origin ? creatorURL : `${origin}/`;
    if (navigation.pageURL) resumeWaitingDocuments(tabId, navigation, navigation.documentId);
  }
  return Boolean(navigation.pageURL);
}
async function openerPageURL(tabId) {
  await openedTabsRestored;
  const openerTabId = openedTabs.get(tabId)?.sourceTabId ?? (await chrome.tabs.get(tabId).catch(() => null))?.openerTabId;
  return openerTabId === void 0 ? void 0 : (await tabOwner(openerTabId))?.pageURL;
}
function isLiveNavigation(tabId, navigation) {
  return isShownNavigation(tabId, navigation) || cachedDocuments.get(tabId)?.get(navigation.documentId) === navigation;
}
function isShownNavigation(tabId, navigation) {
  return tabDocuments.get(tabId) === navigation || tabPendingRequests.get(tabId) === navigation;
}
function isHTTPURL(value) {
  return typeof value === "string" && /^https?:/i.test(value);
}
function urlOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return void 0;
  }
}
function sameURLWithoutFragment(left, right) {
  const leftURL = urlWithoutFragment(left);
  return leftURL !== void 0 && leftURL === urlWithoutFragment(right);
}
function urlWithoutFragment(value) {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.href;
  } catch {
    return void 0;
  }
}
function sameHTTPURLWithoutFragment(left, right) {
  return isHTTPURL(left) && sameURLWithoutFragment(left, right);
}
async function recordMatches(tabId, navigation, result, context, evidence = [context]) {
  try {
    return await queueTabStateUpdate(
      tabId,
      () => recordMatchesNow(tabId, navigation, result, context, evidence)
    );
  } catch (error) {
    if (error instanceof ResultHandlingError) {
      throw error;
    }
    throw new ResultHandlingError(error);
  }
}
async function readNavigationRecord(tabId, navigation) {
  if (navigation.record === void 0) {
    const stateKey = `${TAB_STATE_PREFIX}${tabId}`;
    const stored = (await chrome.storage.session.get(stateKey))[stateKey];
    navigation.record = stored?.documentId === navigation.documentId ? stored : null;
  }
  return navigation.record;
}
async function writeNavigationRecord(tabId, navigation, record) {
  navigation.record = record;
  if (tabDocuments.get(tabId) !== navigation) return;
  const stateKey = `${TAB_STATE_PREFIX}${tabId}`;
  if (record) {
    await storeSession({
      [stateKey]: { ...record, url: boundedURL(record.url), documentId: navigation.documentId }
    });
  } else {
    await chrome.storage.session.remove(stateKey);
  }
}
function storeSession(items) {
  return chrome.storage.session.set(items).catch(() => {
  });
}
async function queueTabStateUpdate(tabId, operation) {
  const previousTail = tabStateQueues.get(tabId) || Promise.resolve();
  const result = previousTail.then(operation);
  const settledTail = result.then(
    () => void 0,
    () => void 0
  );
  tabStateQueues.set(tabId, settledTail);
  try {
    return await result;
  } finally {
    if (tabStateQueues.get(tabId) === settledTail) {
      tabStateQueues.delete(tabId);
    }
  }
}
function scheduleTabScan(tabId, navigation, lane, frameId, operation) {
  return trackWork(navigation, () => scanScheduler.schedule(tabId, navigation, lane, operation, frameId));
}
async function trackWork(navigation, work) {
  navigation.pendingWork += 1;
  try {
    return await work();
  } finally {
    navigation.pendingWork -= 1;
  }
}
function isScanning(tabId) {
  const navigation = tabDocuments.get(tabId);
  return navigation !== void 0 && (navigation.pendingWork > 0 || navigation.requestURLs.queued.length > 0);
}
async function recordMatchesNow(tabId, navigation, result, context, resources) {
  if (!isLiveNavigation(tabId, navigation)) {
    return { ...result, stale: true };
  }
  let currentState;
  try {
    currentState = await readNavigationRecord(tabId, navigation);
  } catch (error) {
    throw new ResultHandlingError(error);
  }
  const currentMatches = Array.isArray(currentState?.matches) ? currentState.matches : [];
  const knownMatches = new Set(currentMatches.map(matchKey));
  const newMatches = [];
  for (const match of result.matches) {
    if (!knownMatches.has(matchKey(match))) {
      newMatches.push(match);
      knownMatches.add(matchKey(match));
    }
  }
  const matches = [...currentMatches, ...newMatches];
  const evidence = Array.isArray(currentState?.evidence) ? [...currentState.evidence] : [];
  const knownEvidence = new Set(evidence.map((item) => item.key));
  let evidenceAdded = false;
  for (const resource of result.matches.length > 0 ? resources : []) {
    if (evidence.length >= MAX_EVIDENCE) break;
    const resourceURL = boundedURL(resource.resourceURL);
    const evidenceKey = `${resource.source}:${resourceURL}:${resource.frameId}`;
    if (knownEvidence.has(evidenceKey)) continue;
    knownEvidence.add(evidenceKey);
    evidenceAdded = true;
    evidence.push({
      key: evidenceKey,
      source: resource.source,
      resourceType: resource.resourceType,
      url: resourceURL,
      frameId: resource.frameId,
      frameURL: boundedURL(resource.frameURL)
    });
  }
  const warnings = Array.isArray(currentState?.warnings) ? [...currentState.warnings] : [];
  const knownWarnings = new Set(warnings.map((warning) => JSON.stringify(warning)));
  let warningsAdded = false;
  for (const warning of result.warnings || []) {
    const key = JSON.stringify(warning);
    if (!knownWarnings.has(key)) {
      warnings.push(warning);
      knownWarnings.add(key);
      warningsAdded = true;
    }
  }
  const nextURL = navigation.pageURL || currentState?.url || context.resourceURL;
  const unchanged = currentState?.scanned === true && currentState.url === nextURL && newMatches.length === 0 && !evidenceAdded && !warningsAdded;
  const record = unchanged ? currentState : {
    url: nextURL,
    frameId: context.frameId,
    rulesVersion: result.rulesVersion,
    matches,
    evidence,
    warnings,
    scanned: true,
    ...currentState?.scanFailure ? { scanFailure: currentState.scanFailure } : {},
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (!unchanged) {
    await writeNavigationRecord(tabId, navigation, record);
  }
  if (result.matches.length === 0) {
    return {
      ...result,
      duplicate: true,
      matches: record.matches
    };
  }
  const duplicate = newMatches.length === 0;
  let warningError;
  if (isShownNavigation(tabId, navigation)) {
    warningError = await presentMatches(tabId, navigation, !duplicate);
  } else if (!duplicate) {
    await flagDocument(tabId, navigation, { unpresented: true });
  }
  if (!duplicate) {
    void reportDetections({
      url: reportedPageURL(navigation, record, context),
      matches: newMatches,
      matchedAt: record.updatedAt,
      extensionVersion: chrome.runtime.getManifest().version
    }).catch(() => {
    });
  }
  if (warningError) {
    throw new ResultHandlingError(warningError);
  }
  return {
    ...result,
    duplicate,
    matches: record.matches
  };
}
function reportedPageURL(navigation, record, context) {
  if (context.source === "top-level-url") return context.resourceURL;
  return isHTTPURL(navigation.documentURL) ? navigation.documentURL : record.url;
}
async function presentMatches(tabId, navigation, hasNewMatches) {
  let warningError;
  try {
    if (!await isWarningAllowed(tabId, navigation)) {
      await showWarning(tabId, navigation);
    }
  } catch (error) {
    warningError = error;
  }
  if (!hasNewMatches) return warningError;
  await setFlaggedBadge(tabId);
  try {
    await chrome.notifications.create(`${NOTIFICATION_PREFIX}${tabId}`, {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon-128.png"),
      title: "ClickNix flagged this site",
      message: "Known threat pattern detected",
      priority: 2
    });
  } catch {
  }
  return warningError;
}
async function showWarning(tabId, navigation) {
  if (!isShownNavigation(tabId, navigation)) {
    return;
  }
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab || tab.pendingUrl === WARNING_URL || tab.url === WARNING_URL && tabDocuments.get(tabId) === navigation) {
    return;
  }
  const warningKey = `${WARNING_STATE_PREFIX}${tabId}`;
  const warning = { url: normalizeHTTPURL(navigation.pageURL) };
  await Promise.all([
    storeSession({ [warningKey]: warning }),
    flagDocument(tabId, navigation)
  ]);
  if (!isShownNavigation(tabId, navigation)) {
    return;
  }
  tabWarningRequests.set(tabId, navigation);
  await chrome.tabs.update(tabId, { url: WARNING_URL }).catch(async (error) => {
    if (await chrome.tabs.get(tabId).then(() => true, () => false)) throw error;
  });
}
async function continueFromWarning(sender) {
  const tabId = sender.tab?.id;
  if (!Number.isInteger(tabId) || sender.url !== WARNING_URL) {
    throw new Error("Continue request did not come from a ClickNix warning tab");
  }
  const warningKey = `${WARNING_STATE_PREFIX}${tabId}`;
  const allowKey = `${WARNING_ALLOW_PREFIX}${tabId}`;
  const warning = (await chrome.storage.session.get(warningKey))[warningKey];
  if (!warning) {
    throw new Error("This warning no longer has a blocked site to continue to");
  }
  const url = normalizeHTTPURL(warning.url);
  await chrome.storage.session.set({ [allowKey]: { url } });
  try {
    await chrome.tabs.update(tabId, { url });
  } catch (error) {
    await chrome.storage.session.remove(allowKey);
    throw error;
  }
  return { ok: true };
}
async function isWarningAllowed(tabId, navigation) {
  const allowKey = `${WARNING_ALLOW_PREFIX}${tabId}`;
  const documentsKey = `${WARNING_DOCUMENTS_PREFIX}${tabId}`;
  const {
    [allowKey]: continued,
    [documentsKey]: documents
  } = await chrome.storage.session.get([allowKey, documentsKey]);
  if (sameHTTPURLWithoutFragment(continued?.url, navigation.pageURL)) return true;
  return (documents ?? []).some((entry) => entry.documentId === navigation.documentId && entry.allowed === true);
}
function normalizeHTTPURL(value) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`Warning target uses unsupported scheme ${url.protocol}`);
  }
  return url.href;
}
async function recordScanFailure(tabId, navigation, error, context) {
  return queueTabStateUpdate(
    tabId,
    () => recordScanFailureNow(tabId, navigation, error, context)
  );
}
async function recordScanFailureNow(tabId, navigation, error, context) {
  if (!isLiveNavigation(tabId, navigation)) {
    return;
  }
  try {
    const currentState = await readNavigationRecord(tabId, navigation);
    await writeNavigationRecord(tabId, navigation, {
      ...currentState,
      url: currentState?.url || navigation.pageURL || context.resourceURL,
      matches: Array.isArray(currentState?.matches) ? currentState.matches : [],
      evidence: Array.isArray(currentState?.evidence) ? currentState.evidence : [],
      scanFailure: currentState?.scanFailure || {
        message: (error instanceof Error ? error.message : String(error)).slice(0, 500),
        source: context.source,
        url: boundedURL(context.resourceURL),
        ...error?.scannerFailure ? {
          code: error.scannerFailure.code,
          stage: error.scannerFailure.stage,
          terminal: error.scannerFailure.terminal
        } : {}
      },
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch {
  }
}
function matchKey(match) {
  return `${match.namespace}:${match.rule}`;
}
async function setFlaggedBadge(tabId) {
  await Promise.allSettled([
    chrome.action.setBadgeText({ tabId, text: "!" }),
    chrome.action.setBadgeBackgroundColor({ tabId, color: "#b42318" })
  ]);
}
async function clearTabPresentation(tabId) {
  await Promise.allSettled([
    chrome.action.setBadgeText({ tabId, text: "" }),
    chrome.notifications.clear(`${NOTIFICATION_PREFIX}${tabId}`)
  ]);
}
function errorMessage(error) {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}
