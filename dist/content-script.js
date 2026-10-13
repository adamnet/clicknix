(() => {
  // src/activation.js
  function whenActivated(start) {
    if (!document.prerendering) {
      start();
      return;
    }
    const activated = () => {
      if (document.prerendering) return;
      observer.disconnect();
      document.removeEventListener("prerenderingchange", activated);
      chrome.runtime.onMessage.removeListener(handleMessage);
      start();
    };
    const handleMessage = (message) => {
      if (message?.type === "start-document") activated();
      return false;
    };
    const listen = () => document.addEventListener("prerenderingchange", activated);
    const observer = new MutationObserver(listen);
    observer.observe(document, { childList: true });
    listen();
    chrome.runtime.onMessage.addListener(handleMessage);
  }

  // src/config.js
  var MAX_RULE_SOURCE_BYTES = 4 * 1024 * 1024;
  var MAX_RULE_BUNDLE_BYTES = 8 * MAX_RULE_SOURCE_BYTES;
  var MAX_SCAN_BYTES = 2 * 1024 * 1024;
  var MAX_CAPTURE_CHARS = 15e5;
  var SCAN_WINDOW_OVERLAP_CHARS = 64 * 1024;
  var SHADOW_ROOT_EVENT_GLOBAL = "clickNixShadowRootEvent";
  var BLOB_SCRIPT_GLOBAL = "clickNixBlobScript";

  // src/runtime-message.js
  var pending = /* @__PURE__ */ new Set();
  var pictureInPicture = matchMedia("(display-mode: picture-in-picture)");
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "rescan-document") {
      for (const resolve of pending) resolve(null);
      pending.clear();
    }
    return false;
  });
  function createMessageSender(onInvalidated) {
    return async (message) => {
      try {
        return await new Promise((resolve, reject) => {
          const sent = chrome.runtime.sendMessage({ ...message, pictureInPicture: pictureInPicture.matches });
          pending.add(resolve);
          sent.then(resolve, reject).finally(() => pending.delete(resolve));
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes("Extension context invalidated")) {
          onInvalidated();
        }
        return null;
      }
    };
  }

  // src/scan-response.js
  function wasScanAttempted(response) {
    return response !== null && response !== void 0 && response.result?.stale !== true;
  }

  // src/scan-window.js
  var call = Function.prototype.call;
  var charCodeAt = call.bind(String.prototype.charCodeAt);
  var slice = call.bind(String.prototype.slice);
  var exec = call.bind(RegExp.prototype.exec);
  var NON_ASCII = /[^\0-\x7f]/g;
  var ASCII_RUN_SEARCH = 16;
  function fitWindow(text, maxChars, maxBytes, start = 0) {
    const segment = slice(text, start, text.length - start < maxChars ? text.length : start + maxChars);
    let index = 0;
    let bytes = 0;
    let ascii = 0;
    while (index < segment.length) {
      const code = charCodeAt(segment, index);
      let units = 1;
      let size = 3;
      if (code < 128) {
        if (++ascii === ASCII_RUN_SEARCH) {
          NON_ASCII.lastIndex = index;
          const run = (exec(NON_ASCII, segment)?.index ?? segment.length) - index;
          if (bytes + run > maxBytes) {
            index += maxBytes - bytes;
            bytes = maxBytes;
            break;
          }
          index += run;
          bytes += run;
          continue;
        }
        size = 1;
      } else {
        ascii = 0;
        if (code < 2048) {
          size = 2;
        } else if (code >= 55296 && code <= 56319) {
          const next = charCodeAt(text, start + index + 1);
          if (next >= 56320 && next <= 57343) {
            units = 2;
            size = 4;
          }
        }
      }
      if (index + units > segment.length || bytes + size > maxBytes) break;
      index += units;
      bytes += size;
    }
    return { chars: index, bytes };
  }
  function utf8Length(text) {
    return fitWindow(text, text.length, Infinity).bytes;
  }
  var TextWindows = class {
    #text = "";
    #start = 0;
    #bytes = 0;
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
    end() {
      const text = this.#text.slice(this.#start);
      this.#text = "";
      this.#start = 0;
      this.#bytes = 0;
      return text ? [text] : [];
    }
  };

  // src/script-source.js
  var DATA_CHUNK_BYTES = 64 * 1024;
  var BASE64_VALUES = new Int8Array(128).fill(-1);
  [..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"].forEach((character, value) => {
    BASE64_VALUES[character.charCodeAt(0)] = value;
  });
  var JAVASCRIPT_ESCAPE_SOURCE = String.raw`\\(?:u\{([0-9A-Fa-f]+)\}|u([0-9A-Fa-f]{4})|x([0-9A-Fa-f]{2})|(\r\n|[\s\S]))`;
  var JAVASCRIPT_ESCAPE = new RegExp(JAVASCRIPT_ESCAPE_SOURCE, "y");
  var JAVASCRIPT_ESCAPES = new RegExp(JAVASCRIPT_ESCAPE_SOURCE, "g");
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
  function encodingName(label) {
    if (typeof label !== "string" || label === "") return void 0;
    try {
      return new TextDecoder(label).encoding;
    } catch {
      return void 0;
    }
  }

  // src/content-script.js
  var seenExternalScripts = /* @__PURE__ */ new Set();
  var loadedScriptURLs = /* @__PURE__ */ new Set();
  var pendingExternalScripts = /* @__PURE__ */ new Set();
  var seenInlineScripts = /* @__PURE__ */ new WeakSet();
  var pendingInlineScripts = /* @__PURE__ */ new WeakSet();
  var dataScriptQueue = [];
  var pendingInlineMessages = /* @__PURE__ */ new Set();
  var pendingChanges = /* @__PURE__ */ new Map();
  var changeQueue = [];
  var openParserHosts = /* @__PURE__ */ new Set();
  var templateOwners = /* @__PURE__ */ new WeakMap();
  var queuedLightHosts = /* @__PURE__ */ new WeakSet();
  var PARSER_PROBE_INTERVAL_MS = 16;
  var MAX_OUTSTANDING_DATA_SCRIPTS = 4;
  var SEPARATOR_MAX_CHARS = 1 + SCAN_WINDOW_OVERLAP_CHARS;
  var HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
  var HTML_VOID_ELEMENTS = /* @__PURE__ */ new Set([
    "area",
    "base",
    "basefont",
    "bgsound",
    "br",
    "col",
    "embed",
    "frame",
    "hr",
    "img",
    "input",
    "keygen",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr"
  ]);
  var HTML_RAW_TEXT_ELEMENTS = /* @__PURE__ */ new Set([
    "iframe",
    "noembed",
    "noframes",
    "plaintext",
    "script",
    "style",
    "xmp"
  ]);
  var HTML_SHADOW_HOST_ELEMENTS = /* @__PURE__ */ new Set([
    "article",
    "aside",
    "blockquote",
    "body",
    "div",
    "footer",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "header",
    "main",
    "nav",
    "p",
    "section",
    "span"
  ]);
  var IGNORED_ATTRIBUTES = /* @__PURE__ */ new Set(["class", "style"]);
  var HTML_ESCAPES = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "\xA0": "&nbsp;"
  };
  var TEXT_ESCAPE_PATTERN = /[&<>\u00a0]/g;
  var ATTRIBUTE_ESCAPE_PATTERN = /[&<>"\u00a0]/g;
  var OBSERVER_OPTIONS = {
    attributes: true,
    characterData: true,
    childList: true,
    subtree: true
  };
  var documentObserver = new MutationObserver(handleDocumentMutations);
  var sendRuntimeMessage = createMessageSender(stopDocumentScanning);
  var shadowRootEvent = globalThis[SHADOW_ROOT_EVENT_GLOBAL];
  var inlineMessageQueue = Promise.resolve();
  var activeDataScriptMessages = 0;
  var rescanGeneration = 0;
  var changeQueueHead = 0;
  var documentScanRequested = false;
  var changedDocumentDrainRunning = false;
  var rescanQueue = Promise.resolve();
  var frontier = null;
  var drainCursor = null;
  var frontierTail = "";
  var preferChanges = false;
  var documentWindowUnscanned = false;
  var parsingWatched = false;
  var documentScanningStarted = false;
  function stopDocumentScanning() {
    documentObserver.disconnect();
    pendingChanges.clear();
    openParserHosts.clear();
    changeQueue.length = 0;
    changeQueueHead = 0;
    documentScanRequested = false;
    finishFrontier();
    dataScriptQueue.length = 0;
  }
  function initialize() {
    if (!chrome.runtime?.id) return;
    chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    whenActivated(startDocumentScanning);
  }
  function handleRuntimeMessage(message, _sender, sendResponse) {
    if (message?.type !== "rescan-document" && message?.type !== "resume-document") {
      return false;
    }
    if (documentScanningStarted) {
      const rescan = rescanQueue.then(rescanDocument);
      rescanQueue = rescan.then(
        () => void 0,
        () => void 0
      );
      void rescan.catch(() => {
      });
    } else {
      startDocumentScanning();
    }
    sendResponse({ ok: true });
    return false;
  }
  function startDocumentScanning() {
    if (documentScanningStarted || document.prerendering) return;
    documentScanningStarted = true;
    listenForShadowRoots();
    documentObserver.observe(document, OBSERVER_OPTIONS);
    frontier = new NodeSerializationCursor(document, true, true);
    document.addEventListener("readystatechange", () => void drainChangedDocumentNodes());
    watchParsing();
    void drainChangedDocumentNodes();
    scanScriptElements();
    observeLoadedScripts();
    scanRegisteredServiceWorkers();
  }
  function listenForShadowRoots() {
    addEventListener(shadowRootEvent, handleShadowRootAttached, true);
  }
  function scanDocument() {
    documentScanRequested = true;
    void drainChangedDocumentNodes();
  }
  async function rescanDocument() {
    if (changedDocumentDrainRunning || documentWindowUnscanned) scanDocument();
    await Promise.allSettled([...pendingInlineMessages]);
    rescanGeneration += 1;
    scanScriptElements();
    scanLoadedScriptResources();
    scanRegisteredServiceWorkers();
  }
  function scanScriptElements() {
    for (const script of document.querySelectorAll("script")) {
      queueScriptElement(script);
    }
  }
  function observeLoadedScripts() {
    new PerformanceObserver((entries) => {
      for (const entry of entries.getEntries()) {
        if (entry.initiatorType === "script" && !loadedScriptURLs.has(entry.name)) {
          loadedScriptURLs.add(entry.name);
          queueExternalScriptURL(entry.name);
        }
      }
    }).observe({ type: "resource", buffered: true });
  }
  function scanLoadedScriptResources() {
    for (const url of loadedScriptURLs) {
      queueExternalScriptURL(url);
    }
  }
  function scanRegisteredServiceWorkers() {
    if (self.origin === "null" || !/^https?:$/.test(location.protocol) || !navigator.serviceWorker?.getRegistrations) {
      return;
    }
    void navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        for (const worker of [
          registration.active,
          registration.waiting,
          registration.installing
        ]) {
          if (worker?.scriptURL) {
            queueExternalScriptURL(worker.scriptURL, "utf-8");
          }
        }
      }
    }).catch(() => {
    });
  }
  function handleDocumentMutations(mutations) {
    if (!chrome.runtime?.id) {
      stopDocumentScanning();
      return;
    }
    for (const mutation of mutations) {
      const { target } = mutation;
      if (mutation.type === "childList") {
        if (mutation.removedNodes.length > 0) {
          frontier?.childrenRemoved(mutation);
          if (drainCursor !== frontier) drainCursor?.childrenRemoved(mutation);
        }
        if (isScriptElement(target)) {
          queueScriptElement(target, true);
          continue;
        }
        if (target === document) {
          listenForShadowRoots();
          watchParsing();
        }
        if (frontier?.coversChildren(target, mutation.nextSibling)) continue;
        const covered = pendingChanges.get(target) === true;
        const { addedNodes } = mutation;
        for (let index = 0; index < addedNodes.length; index += 1) {
          const node = addedNodes[index];
          if (!covered) queueChangedNode(node, true);
          if (node.nodeType === Node.ELEMENT_NODE) queueInsertedScripts(node);
        }
      } else if (mutation.type === "characterData") {
        const parent = target.parentNode;
        if (isScriptElement(parent)) {
          queueScriptElement(parent, true);
        } else if (!frontier?.isAhead(target) && pendingChanges.get(parent) !== true) {
          queueChangedNode(target, true);
        }
      } else if (!IGNORED_ATTRIBUTES.has(mutation.attributeName)) {
        if (isScriptElement(target) && (mutation.attributeName === "src" || mutation.attributeName === "href")) {
          queueScriptElement(target, true);
        } else if (!frontier?.isAhead(target) && pendingChanges.get(target.parentNode) !== true) {
          queueChangedNode(target, false);
        }
      }
    }
    void drainChangedDocumentNodes();
  }
  function queueInsertedScripts(element) {
    if (isScriptElement(element)) {
      queueScriptElement(element, true);
    } else if (element.firstElementChild) {
      for (const script of element.querySelectorAll("script")) {
        queueScriptElement(script, true);
      }
    }
  }
  function queueChangedNode(node, subtree) {
    const pending2 = pendingChanges.get(node);
    if (pending2 === void 0) changeQueue.push(node);
    if (pending2 !== true) pendingChanges.set(node, subtree);
  }
  function handleShadowRootAttached(event) {
    const element = event.target;
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      if (!frontier?.isAhead(element) && pendingChanges.get(element.parentNode) !== true) {
        queueChangedNode(element, false);
        void drainChangedDocumentNodes();
      }
      return;
    }
    if (!(element instanceof HTMLElement)) return;
    const shadowRoot = chrome.dom.openOrClosedShadowRoot(element);
    if (shadowRoot) observeShadowRoot(shadowRoot);
  }
  function watchParsing() {
    if (parsingWatched || document.readyState !== "loading") return;
    parsingWatched = true;
    setTimeout(probeParsing, PARSER_PROBE_INTERVAL_MS);
  }
  function probeParsing() {
    parsingWatched = false;
    probeOpenParserHosts();
    void drainChangedDocumentNodes();
    if (document.readyState === "loading" || openParserHosts.size > 0) {
      parsingWatched = true;
      setTimeout(probeParsing, PARSER_PROBE_INTERVAL_MS);
    }
  }
  function watchOpenParserHost(element) {
    if (isOnParserPath(element)) openParserHosts.add(element);
  }
  function probeOpenParserHosts() {
    const parsing = document.readyState === "loading";
    for (const element of openParserHosts) {
      const shadowRoot = chrome.dom.openOrClosedShadowRoot(element);
      if (shadowRoot) {
        observeShadowRoot(shadowRoot);
        if (!frontier?.adoptShadowRoot(element, shadowRoot)) queueChangedNode(shadowRoot, true);
      }
      if (shadowRoot || !parsing || !isOnParserPath(element)) {
        openParserHosts.delete(element);
      }
    }
  }
  function isOnParserPath(start) {
    for (let node = start; node; node = node.parentNode ?? node.host ?? templateOwners.get(node)) {
      if (node.nextSibling) return false;
      if (node === document) return true;
    }
    return false;
  }
  function observeShadowRoot(shadowRoot) {
    documentObserver.observe(shadowRoot, OBSERVER_OPTIONS);
    shadowRoot.addEventListener(shadowRootEvent, handleShadowRootAttached, true);
  }
  async function sendTextWindows(type, text) {
    const windows = new TextWindows();
    for (const payload of [...windows.push(text), ...windows.end()]) {
      const response = await sendRuntimeMessage({ type, url: location.href, payload });
      if (!wasScanAttempted(response)) return false;
    }
    return true;
  }
  async function drainChangedDocumentNodes() {
    if (changedDocumentDrainRunning) return;
    changedDocumentDrainRunning = true;
    let overlap = "";
    try {
      while (chrome.runtime?.id) {
        probeOpenParserHosts();
        preferChanges = !preferChanges;
        let payload = overlap;
        let bytes = utf8Length(overlap);
        let documentPayload = false;
        for (; ; ) {
          if (!drainCursor) {
            if (payload.length + SEPARATOR_MAX_CHARS >= MAX_CAPTURE_CHARS || bytes + SEPARATOR_MAX_CHARS * 3 >= MAX_SCAN_BYTES) break;
            drainCursor = nextChangeCursor();
            if (!drainCursor) break;
            const separator = `${payload.length > 0 ? "\n" : ""}${drainCursor === frontier ? frontierTail : ""}`;
            payload += separator;
            bytes += utf8Length(separator);
          }
          documentPayload ||= drainCursor.document;
          const read = drainCursor.read(MAX_CAPTURE_CHARS - payload.length, MAX_SCAN_BYTES - bytes);
          payload += read.text;
          bytes += read.bytes;
          if (drainCursor === frontier) {
            frontier.document = false;
            frontierTail = (frontierTail + read.text).slice(-SCAN_WINDOW_OVERLAP_CHARS);
            if (frontier.done) finishFrontier();
          }
          if (!drainCursor.done && !drainCursor.parked) break;
          drainCursor = null;
        }
        if (payload.length === overlap.length) break;
        overlap = drainCursor ? payload.slice(-SCAN_WINDOW_OVERLAP_CHARS) : "";
        const response = await sendRuntimeMessage({
          type: documentPayload ? "scan-document" : "scan-document-change",
          url: location.href,
          payload
        });
        if (!wasScanAttempted(response)) documentWindowUnscanned = true;
      }
    } finally {
      drainCursor = null;
      changedDocumentDrainRunning = false;
      if (chrome.runtime?.id && (documentScanRequested || changeQueueHead < changeQueue.length)) {
        void drainChangedDocumentNodes();
      }
    }
  }
  function finishFrontier() {
    frontier = null;
    frontierTail = "";
  }
  function nextChangeCursor() {
    if (documentScanRequested) {
      documentScanRequested = false;
      documentWindowUnscanned = false;
      if (document.documentElement) {
        return new NodeSerializationCursor(document.documentElement, true);
      }
    }
    const frontierReady = frontier?.ready() === true;
    if (frontier?.done) finishFrontier();
    if (frontierReady && !preferChanges) return frontier;
    while (changeQueueHead < changeQueue.length) {
      const node = changeQueue[changeQueueHead];
      changeQueueHead += 1;
      const subtree = pendingChanges.get(node);
      if (subtree === void 0) continue;
      pendingChanges.delete(node);
      return new NodeSerializationCursor(node, subtree);
    }
    changeQueue.length = 0;
    changeQueueHead = 0;
    return frontierReady ? frontier : null;
  }
  var NodeSerializationCursor = class {
    constructor(root, subtree, isFrontier = false) {
      this.frontier = isFrontier;
      this.document = isFrontier || root === document.documentElement;
      this.parked = false;
      this.loading = document.readyState === "loading";
      this.openWalks = /* @__PURE__ */ new Map();
      this.shadowHosts = [];
      this.stack = [];
      this.pending = "";
      this.offset = 0;
      if (subtree) {
        this.visit(root, hasRawText(root.parentNode, false), false);
      } else {
        this.pending = startTag(root, root.localName);
      }
      if (isFrontier) this.snapshot();
    }
    get done() {
      return this.offset >= this.pending.length && this.stack.length === 0;
    }
    // Whether output is available now; the frontier may resume or finish here.
    ready() {
      this.resume();
      const available = this.advance();
      this.snapshot();
      return available;
    }
    resume() {
      this.parked = false;
      this.loading = document.readyState === "loading";
    }
    read(maxChars, maxBytes) {
      let text = "";
      let bytes = 0;
      this.resume();
      while (text.length < maxChars && this.advance()) {
        const taken = fitWindow(this.pending, maxChars - text.length, maxBytes - bytes, this.offset);
        if (taken.chars === 0) break;
        text += this.pending.slice(this.offset, this.offset + taken.chars);
        this.offset += taken.chars;
        bytes += taken.bytes;
      }
      this.snapshot();
      return { text, bytes };
    }
    // A root is serialized before its host's light children, and the frontier may wait at
    // its end until parsing ends. Meanwhile the host's light DOM is scanned as changes, and
    // serialized again when the frontier gets there.
    snapshot() {
      this.openWalks.clear();
      this.shadowHosts.length = 0;
      for (const entry of this.stack) {
        if (typeof entry === "string") continue;
        entry.ahead = null;
        this.openWalks.set(entry.parent, entry);
        const { host } = entry.parent;
        if (entry.parent.nodeType !== Node.DOCUMENT_FRAGMENT_NODE || !host) continue;
        this.shadowHosts.push(host);
        if (this.parked && !queuedLightHosts.has(host)) {
          queuedLightHosts.add(host);
          for (let child = host.firstChild; child; child = child.nextSibling) {
            queueChangedNode(child, true);
          }
        }
      }
    }
    inShadowHost(node) {
      for (const host of this.shadowHosts) {
        if (host.contains(node)) return true;
      }
      return false;
    }
    // A walk whose last visited child was removed (or moved, which removes it
    // first) continues after the child that preceded it, so the page cannot
    // make it skip the children after the old place by moving the child later.
    childrenRemoved({ target, removedNodes, previousSibling }) {
      const walk = this.openWalks.get(target);
      if (walk?.previous == null) return;
      for (let index = 0; index < removedNodes.length; index += 1) {
        if (removedNodes[index] === walk.previous) {
          walk.previous = previousSibling;
          walk.prior = null;
          walk.ahead = null;
          return;
        }
      }
    }
    // The parser may attach a declarative shadow root after the frontier visited its host.
    // While the frontier waits in the host's walk, the root is serialized in place, so later
    // insertions continue the frontier's output instead of each becoming a change.
    adoptShadowRoot(host, shadowRoot) {
      const top = this.stack[this.stack.length - 1];
      if (this.offset < this.pending.length || typeof top !== "object" || top.parent !== host) {
        return false;
      }
      this.pending = this.pushShadowRoot(shadowRoot, top.inert);
      this.offset = 0;
      this.snapshot();
      return true;
    }
    // Whether the frontier will serialize a child list change of `target`
    // whose added nodes precede `nextSibling`: `target` is ahead, or the nodes
    // were appended to a parent whose walk is open.
    coversChildren(target, nextSibling) {
      return nextSibling === null && this.openWalks.has(target) && !this.inShadowHost(target) || this.isAhead(target);
    }
    // Whether the frontier has yet to reach `node`: below the nearest parent with an open
    // walk, it follows the last visited child. A node inserted elsewhere than at that
    // parent's end counts as passed, which at worst serializes it twice.
    isAhead(node) {
      if (this.inShadowHost(node)) return false;
      for (let child = node, parent = node?.parentNode; parent; child = parent, parent = parent.parentNode) {
        const walk = this.openWalks.get(parent);
        if (walk !== void 0) return isUnvisitedChild(walk, child);
      }
      return false;
    }
    // Makes pending hold unread output; false once the walk is complete or the
    // frontier is waiting for the parser.
    advance() {
      while (this.offset >= this.pending.length) {
        const top = this.stack[this.stack.length - 1];
        if (top === void 0) return false;
        this.pending = "";
        this.offset = 0;
        if (typeof top === "string") {
          this.stack.pop();
          this.pending = top;
          continue;
        }
        const node = this.nextChild(top);
        if (node) {
          top.prior = top.previous;
          top.previous = node;
          this.visit(node, top.rawText, top.inert);
        } else if (node === null && this.mayGrow(top.parent)) {
          this.parked = true;
          return false;
        } else {
          this.stack.pop();
        }
      }
      return true;
    }
    // The next child to visit, null at the end, or undefined if the walk lost
    // its place and its parent was queued again.
    nextChild({ parent, previous, prior }) {
      if (previous === null) return parent.firstChild;
      if (previous.parentNode === parent) return previous.nextSibling;
      if (prior === null) return parent.firstChild;
      if (prior.parentNode === parent) return prior.nextSibling;
      queueChangedNode(parent, true);
      return void 0;
    }
    // Whether the parser may still append to the node: only the frontier waits,
    // and only while the document loads.
    mayGrow(parent) {
      return this.frontier && this.loading && isOnParserPath(parent);
    }
    visit(node, rawText, inert) {
      if (pendingChanges.size > 0) pendingChanges.delete(node);
      switch (node.nodeType) {
        case Node.ELEMENT_NODE:
          this.visitElement(node, inert);
          break;
        case Node.TEXT_NODE:
        case Node.CDATA_SECTION_NODE:
          this.pending = rawText ? node.data : escapeHTML(node.data, TEXT_ESCAPE_PATTERN);
          break;
        case Node.COMMENT_NODE:
          this.pending = `<!--${node.data}-->`;
          break;
        case Node.PROCESSING_INSTRUCTION_NODE:
          this.pending = `<?${node.target} ${node.data}?>`;
          break;
        case Node.DOCUMENT_NODE:
        case Node.DOCUMENT_FRAGMENT_NODE:
          if (node instanceof ShadowRoot) {
            this.pending = this.pushShadowRoot(node, inert);
          } else {
            this.pushChildren(node, false, inert);
          }
          break;
      }
    }
    visitElement(element, inert) {
      const tag = element.localName;
      const html = element.namespaceURI === HTML_NAMESPACE;
      this.pending = startTag(element, tag, html);
      if (html && HTML_VOID_ELEMENTS.has(tag)) return;
      this.stack.push(`</${tag}>`);
      const template = html && tag === "template";
      if (template) templateOwners.set(element.content, element);
      this.pushChildren(
        template ? element.content : element,
        hasRawText(element, inert),
        inert || template
      );
      if (this.frontier && !inert && tag === "script" && isScriptElement(element) && !seenInlineScripts.has(element)) {
        queueScriptElement(element, true);
      }
      if (!html || !(HTML_SHADOW_HOST_ELEMENTS.has(tag) || tag.includes("-"))) return;
      const shadowRoot = chrome.dom.openOrClosedShadowRoot(element);
      if (shadowRoot) {
        if (pendingChanges.size > 0) pendingChanges.delete(shadowRoot);
        this.pending += this.pushShadowRoot(shadowRoot, inert);
      } else if (this.loading) {
        watchOpenParserHost(element);
      }
    }
    // A shadow root is written as Chrome's getHTML() writes it, as a declarative
    // shadow root, before the host's children. Returns its start tag.
    pushShadowRoot(shadowRoot, inert) {
      observeShadowRoot(shadowRoot);
      this.stack.push("</template>");
      this.pushChildren(shadowRoot, false, inert);
      let tag = `<template shadowrootmode="${shadowRoot.mode}"`;
      if (shadowRoot.delegatesFocus) tag += ' shadowrootdelegatesfocus=""';
      if (shadowRoot.serializable) tag += ' shadowrootserializable=""';
      if (shadowRoot.slotAssignment === "manual") tag += ' shadowrootslotassignment="manual"';
      if (shadowRoot.clonable) tag += ' shadowrootclonable=""';
      return `${tag}>`;
    }
    // A walk of parent's children. previous and prior are the last two
    // children visited; ahead is the observer's record of the children after
    // previous (see isUnvisitedChild).
    pushChildren(parent, rawText, inert) {
      if (parent.firstChild || this.mayGrow(parent)) {
        this.stack.push({
          parent,
          previous: null,
          prior: null,
          rawText,
          inert,
          ahead: null,
          aheadLast: null
        });
      }
    }
  };
  function isUnvisitedChild(walk, child) {
    const { parent, previous } = walk;
    if (previous === null) return true;
    if (previous.parentNode !== parent) return false;
    if (walk.ahead === null) {
      walk.ahead = /* @__PURE__ */ new Set();
      walk.aheadLast = previous;
    }
    if (!walk.ahead.has(child)) {
      for (let next = walk.aheadLast.nextSibling; next; next = next.nextSibling) {
        walk.ahead.add(next);
        walk.aheadLast = next;
      }
    }
    return walk.ahead.has(child);
  }
  function startTag(element, tag, html = element.namespaceURI === HTML_NAMESPACE) {
    let text = `<${tag}`;
    if (element.hasAttributes()) {
      for (const name of element.getAttributeNames()) {
        text += ` ${name}="${escapeHTML(element.getAttribute(name), ATTRIBUTE_ESCAPE_PATTERN)}"`;
      }
    }
    if (html && (tag === "textarea" || tag === "input" && element.type !== "password") && element.value !== element.defaultValue) {
      text += ` value="${escapeHTML(element.value, ATTRIBUTE_ESCAPE_PATTERN)}"`;
    }
    return `${text}>`;
  }
  function escapeHTML(value, pattern) {
    return value.replace(pattern, escapeHTMLCharacter);
  }
  function escapeHTMLCharacter(character) {
    return HTML_ESCAPES[character];
  }
  function hasRawText(element, inert) {
    return element?.namespaceURI === HTML_NAMESPACE && (HTML_RAW_TEXT_ELEMENTS.has(element.localName) || !inert && element.localName === "noscript");
  }
  function isScriptElement(node) {
    return node?.localName === "script" && (node instanceof HTMLScriptElement || node instanceof SVGScriptElement);
  }
  function externalScriptURL(script) {
    return script instanceof HTMLScriptElement ? script.src : script.href.baseVal;
  }
  function inlineScriptText(script) {
    let text = "";
    for (let node = script.firstChild; node; node = node.nextSibling) {
      if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.CDATA_SECTION_NODE) {
        text += node.data;
      }
    }
    return text;
  }
  function queueScriptElement(script, live = false) {
    const url = externalScriptURL(script);
    if (url) {
      const encoding = scriptFallbackEncoding(script);
      if (url.startsWith("blob:") && encoding !== "utf-8") globalThis[BLOB_SCRIPT_GLOBAL]?.(url, encoding);
      queueExternalScriptURL(url, encoding);
      return;
    }
    if (pendingInlineScripts.has(script) || !live && seenInlineScripts.has(script)) {
      return;
    }
    pendingInlineScripts.add(script);
    let scannedText = "";
    const pending2 = inlineMessageQueue.then(async () => {
      scannedText = inlineScriptText(script);
      if (!scannedText) return;
      if (await sendTextWindows("scan-script", scannedText)) {
        seenInlineScripts.add(script);
      } else {
        seenInlineScripts.delete(script);
      }
    }).finally(() => {
      pendingInlineScripts.delete(script);
      pendingInlineMessages.delete(pending2);
      if (inlineScriptText(script) !== scannedText) queueScriptElement(script, true);
    });
    inlineMessageQueue = pending2.then(() => void 0, () => void 0);
    pendingInlineMessages.add(pending2);
  }
  function scriptFallbackEncoding(script) {
    const label = script instanceof HTMLScriptElement ? script.getAttribute("charset") : null;
    return encodingName(label) ?? encodingName(document.characterSet) ?? "utf-8";
  }
  function queueExternalScriptURL(url, encoding = scriptFallbackEncoding()) {
    const normalizedURL = normalizeExternalScriptURL(url);
    const key = `${encoding} ${normalizedURL}`;
    if (!normalizedURL || seenExternalScripts.has(key) || pendingExternalScripts.has(key)) return;
    pendingExternalScripts.add(key);
    const entry = { url: normalizedURL, encoding, key };
    if (isDataURL(normalizedURL)) {
      dataScriptQueue.push(entry);
      pumpDataScriptQueue();
    } else {
      void sendExternalScriptURL(entry).catch(() => {
      });
    }
  }
  function pumpDataScriptQueue() {
    while (activeDataScriptMessages < MAX_OUTSTANDING_DATA_SCRIPTS && dataScriptQueue.length > 0) {
      const entry = dataScriptQueue.shift();
      activeDataScriptMessages += 1;
      void sendExternalScriptURL(entry).catch(() => {
      }).finally(() => {
        activeDataScriptMessages -= 1;
        pumpDataScriptQueue();
      });
    }
  }
  async function sendExternalScriptURL(entry) {
    const generation = rescanGeneration;
    let response = null;
    try {
      response = await sendRuntimeMessage({
        type: "scan-script-url",
        url: entry.url,
        encoding: entry.encoding
      });
    } finally {
      pendingExternalScripts.delete(entry.key);
    }
    if (wasScanAttempted(response)) {
      if (!isDataURL(entry.url)) seenExternalScripts.add(entry.key);
    } else if (generation !== rescanGeneration) {
      queueExternalScriptURL(entry.url, entry.encoding);
    }
  }
  function isDataURL(url) {
    return url.slice(0, 5).toLowerCase() === "data:";
  }
  function normalizeExternalScriptURL(value) {
    if (typeof value !== "string" || value.length === 0) return null;
    try {
      const url = new URL(value, document.baseURI);
      if (["http:", "https:"].includes(url.protocol)) url.hash = "";
      return url.href;
    } catch {
      return value;
    }
  }
  initialize();
})();
