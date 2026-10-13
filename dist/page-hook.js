"use strict";
(() => {
  // src/config.js
  var MAX_RULE_SOURCE_BYTES = 4 * 1024 * 1024;
  var MAX_RULE_BUNDLE_BYTES = 8 * MAX_RULE_SOURCE_BYTES;
  var MAX_SCAN_BYTES = 2 * 1024 * 1024;
  var MAX_CAPTURE_CHARS = 15e5;
  var SCAN_WINDOW_OVERLAP_CHARS = 64 * 1024;
  var shadowRootEventType = (handshakeId2) => `clicknix-attach-shadow-${handshakeId2}`;
  var popupClipboardEventType = (handshakeId2) => `clicknix-popup-clipboard-${handshakeId2}`;

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

  // src/page-hook.js
  var PAGE_HOOK_RESPONSE = "clicknix-response-body";
  var PAGE_HOOK_CLIPBOARD = "clicknix-clipboard-text";
  var PAGE_HOOK_SCRIPT_URL = "clicknix-script-url";
  var PAGE_HOOK_ACK = "clicknix-page-hook-ack";
  var PAGE_HOOK_READY = "clicknix-page-hook-ready";
  var PAGE_HOOK_STOP = "clicknix-page-hook-stop";
  var PAGE_HOOK_BLOB_SCRIPT = "clicknix-blob-script";
  var HOOK_KEY = "__clickNixPageHook";
  var SHADOW_ROOT_KEY = "__clickNixShadowRoot";
  var {
    apply,
    construct,
    defineProperty: nativeDefineProperty,
    getOwnPropertyDescriptor: nativeGetOwnPropertyDescriptor,
    getPrototypeOf,
    ownKeys,
    set: reflectSet,
    setPrototypeOf
  } = Reflect;
  var defineProperty = (target, key, descriptor) => nativeDefineProperty(target, key, { __proto__: null, ...descriptor });
  function getOwnPropertyDescriptor(target, key) {
    const descriptor = nativeGetOwnPropertyDescriptor(target, key);
    return descriptor && { __proto__: null, ...descriptor };
  }
  var getter = (prototype, name) => getOwnPropertyDescriptor(prototype, name).get;
  var append = (list, value) => defineProperty(list, list.length, {
    value,
    writable: true,
    enumerable: true,
    configurable: true
  });
  function removeAt(list, index) {
    const value = list[index];
    for (let next = index + 1; next < list.length; next += 1) list[next - 1] = list[next];
    list.length -= 1;
    return value;
  }
  var { max, min } = Math;
  var freeze = Object.freeze;
  var NativeTypeError = TypeError;
  var NativePromise = Promise;
  var NativeProxy = Proxy;
  function own(promise) {
    defineProperty(promise, "constructor", { value: NativePromise });
    return promise;
  }
  async function settle(promise, onFulfilled, onRejected) {
    let value;
    try {
      value = await own(promise);
    } catch (error) {
      onRejected(error);
      return;
    }
    onFulfilled(value);
  }
  var isArray = Array.isArray;
  var iteratorSymbol = Symbol.iterator;
  var isFiniteNumber = Number.isFinite;
  var objectKeys = Object.keys;
  var isPrototypeOf = Object.prototype.isPrototypeOf;
  var NativeEvent = Event;
  var NativeMessageEvent = MessageEvent;
  var NativeTextDecoder = TextDecoder;
  var NativeTextEncoder = TextEncoder;
  var NativeUint8Array = Uint8Array;
  var promiseReject = Promise.reject;
  var textDecode = TextDecoder.prototype.decode;
  var textDecoderEncoding = getter(TextDecoder.prototype, "encoding");
  var textEncode = TextEncoder.prototype.encode;
  var regExpExec = RegExp.prototype.exec;
  var stringSlice = String.prototype.slice;
  var stringCharCodeAt = String.prototype.charCodeAt;
  var stringToLowerCase = String.prototype.toLowerCase;
  var stringIncludes = String.prototype.includes;
  var stringEndsWith = String.prototype.endsWith;
  var stringPadStart = String.prototype.padStart;
  var numberToString = Number.prototype.toString;
  var addListener = EventTarget.prototype.addEventListener;
  var removeListener = EventTarget.prototype.removeEventListener;
  var dispatchEvent = EventTarget.prototype.dispatchEvent;
  var messageEventData = getter(MessageEvent.prototype, "data");
  var messageEventOrigin = getter(MessageEvent.prototype, "origin");
  var postPortMessage = MessagePort.prototype.postMessage;
  var startPort = MessagePort.prototype.start;
  var closePort = MessagePort.prototype.close;
  var responseBody = getter(Response.prototype, "body");
  var responseHeaders = getter(Response.prototype, "headers");
  var responseURL = getter(Response.prototype, "url");
  var responseClone = Response.prototype.clone;
  var headersGet = Headers.prototype.get;
  var pipeTo = ReadableStream.prototype.pipeTo;
  var streamLocked = getter(ReadableStream.prototype, "locked");
  var NativeWritableStream = WritableStream;
  var NativeAbortController = AbortController;
  var abortSignalOf = getter(AbortController.prototype, "signal");
  var abortController = AbortController.prototype.abort;
  var typedArrayPrototype = getPrototypeOf(Uint8Array.prototype);
  var typedArrayBuffer = getter(typedArrayPrototype, "buffer");
  var typedArrayByteOffset = getter(typedArrayPrototype, "byteOffset");
  var typedArrayByteLength = getter(typedArrayPrototype, "byteLength");
  var xhrReadyState = getter(XMLHttpRequest.prototype, "readyState");
  var xhrResponse = getter(XMLHttpRequest.prototype, "response");
  var xhrResponseText = getter(XMLHttpRequest.prototype, "responseText");
  var xhrResponseType = getter(XMLHttpRequest.prototype, "responseType");
  var xhrResponseURL = getter(XMLHttpRequest.prototype, "responseURL");
  var xhrResponseHeader = XMLHttpRequest.prototype.getResponseHeader;
  var windowDocument = getOwnPropertyDescriptor(window, "document").get;
  var windowLength = getOwnPropertyDescriptor(window, "length").get;
  var documentDefaultView = getter(Document.prototype, "defaultView");
  var documentReadyState = getter(Document.prototype, "readyState");
  var nodeOwnerDocument = getter(Node.prototype, "ownerDocument");
  var nodeBaseURI = getter(Node.prototype, "baseURI");
  var documentURL = getter(Document.prototype, "URL");
  var documentCharacterSet = getter(Document.prototype, "characterSet");
  var documentQuerySelectorAll = Document.prototype.querySelectorAll;
  var elementGetAttribute = Element.prototype.getAttribute;
  var documentHead = getter(Document.prototype, "head");
  var documentElementOf = getter(Document.prototype, "documentElement");
  var elementOuterHTML = getter(Element.prototype, "outerHTML");
  var elementLocalName = getter(Element.prototype, "localName");
  var elementGetHTML = Element.prototype.getHTML;
  var cloneNode = Node.prototype.cloneNode;
  var shadowRootHost = getter(ShadowRoot.prototype, "host");
  var createElementNS = Document.prototype.createElementNS;
  var HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
  var appendChild = Node.prototype.appendChild;
  var removeElement = Element.prototype.remove;
  var frameContentWindow = getter(HTMLIFrameElement.prototype, "contentWindow");
  var frameWindowGetters = freeze({
    __proto__: null,
    iframe: frameContentWindow,
    frame: getter(HTMLFrameElement.prototype, "contentWindow"),
    object: getter(HTMLObjectElement.prototype, "contentWindow")
  });
  var getRootNode = Node.prototype.getRootNode;
  var nodeTypeOf = getter(Node.prototype, "nodeType");
  var DOCUMENT_FRAGMENT_NODE = 11;
  var COMPOSED = freeze({ __proto__: null, composed: true });
  var NativeWeakRef = WeakRef;
  var weakRefDeref = WeakRef.prototype.deref;
  var NativeFinalizationRegistry = FinalizationRegistry;
  var finalizationRegister = FinalizationRegistry.prototype.register;
  var fragmentQuerySelectorAll = DocumentFragment.prototype.querySelectorAll;
  var nodeListLength = getter(NodeList.prototype, "length");
  var elementChildCount = getter(Element.prototype, "childElementCount");
  var querySelector = Element.prototype.querySelector;
  var windowParent = getOwnPropertyDescriptor(window, "parent").get;
  var windowTop = getOwnPropertyDescriptor(window, "top").get;
  var windowOpener = getOwnPropertyDescriptor(window, "opener").get;
  var windowPerformance = getOwnPropertyDescriptor(window, "performance").get;
  var performanceEntriesByType = Performance.prototype.getEntriesByType;
  var serverTimingOf = getter(PerformanceResourceTiming.prototype, "serverTiming");
  var serverTimingName = getter(PerformanceServerTiming.prototype, "name");
  var NativeURL = URL;
  var urlHref = getter(URL.prototype, "href");
  var revokeObjectURL = URL.revokeObjectURL;
  var trustedScriptURLText = typeof TrustedScriptURL === "function" ? TrustedScriptURL.prototype.toString : void 0;
  var rangeContainer = getter(Range.prototype, "commonAncestorContainer");
  var NativeMutationObserver = MutationObserver;
  var observeMutations = MutationObserver.prototype.observe;
  var disconnectObserver = MutationObserver.prototype.disconnect;
  var NativeWeakSet = WeakSet;
  var NativeWeakMap = WeakMap;
  var weakMapGet = WeakMap.prototype.get;
  var weakMapSet = WeakMap.prototype.set;
  var weakMapDelete = WeakMap.prototype.delete;
  var clipboardItemGetType = typeof ClipboardItem === "function" ? ClipboardItem.prototype.getType : void 0;
  var blobText = Blob.prototype.text;
  var blobSlice = Blob.prototype.slice;
  var blobType = getter(Blob.prototype, "type");
  var blobStream = Blob.prototype.stream;
  var weakSetHas = WeakSet.prototype.has;
  var weakSetAdd = WeakSet.prototype.add;
  var NativeSet = Set;
  var setHas = Set.prototype.has;
  var setAdd = Set.prototype.add;
  var setDelete = Set.prototype.delete;
  var scheduleTimeout = window.setTimeout.bind(window);
  var cancelTimeout = window.clearTimeout.bind(window);
  var now = performance.now.bind(performance);
  var utf8Encoder = new NativeTextEncoder();
  var utf8Decoder = new NativeTextDecoder();
  var PLAIN_TEXT_FORMAT = /^\s*text(?:\/plain)?\s*$/i;
  var SET_DATA_PLAIN_TEXT_FORMAT = /^\s*text(?:\/plain(?:;[^]*)?)?\s*$/i;
  var TEXT_MEDIA_TYPE = new RegExp(
    "^\\s*(?:text/[^;]*|application/(?:javascript|json|ld\\+json|x-javascript|xhtml\\+xml|xml)\\s*)(?:;|$)",
    "i"
  );
  var CHARSET_PARAMETER = /;\s*charset\s*=\s*"?([^";\s]+)/i;
  var TEXT_URL_EXTENSION = /\.(?:css|html?|js|json|xml)(?:[?#]|$)/i;
  var captureQueue = [];
  var handshakeId = [...crypto.getRandomValues(new Uint32Array(4))].map((part) => part.toString(16).padStart(8, "0")).join("");
  var popupClipboardEvent = popupClipboardEventType(handshakeId);
  var bridgePort;
  var captureStopped = false;
  var MAX_ACTIVE_CAPTURES = 4;
  var READ_CHUNK_BYTES = 64 * 1024;
  var CAPTURE_MEMORY_RESERVATION = MAX_CAPTURE_CHARS * 2 + READ_CHUNK_BYTES;
  var CAPTURE_MEMORY_MINIMUM = (SCAN_WINDOW_OVERLAP_CHARS + READ_CHUNK_BYTES) * 2 + READ_CHUNK_BYTES;
  var CAPTURE_MEMORY_LIMIT = MAX_ACTIVE_CAPTURES * CAPTURE_MEMORY_RESERVATION;
  var CAPTURE_FLUSH_MS = 100;
  var FLUSH_DUE = freeze({ __proto__: null });
  var activeCaptures = 0;
  var preferNewestCapture = true;
  var nextMessageId = 1;
  var pendingAcks = { __proto__: null };
  function hookFetch(realm, facadeOf) {
    const nativeFetch = realm.fetch;
    if (typeof nativeFetch !== "function") {
      return;
    }
    const RealmPromise = realm.Promise;
    realm.fetch = {
      fetch(input) {
        const result = apply(nativeFetch, this, arguments);
        return facadeOf()?.fetched(result, realm, RealmPromise) ?? result;
      }
    }.fetch;
  }
  function fetched(result, realm, RealmPromise) {
    if (captureStopped) return result;
    return new RealmPromise((resolve, reject) => {
      void settle(result, (response) => {
        const admitted = () => resolve(response);
        void settle(captureFetchResponse(response, realm), admitted, admitted);
      }, reject);
    });
  }
  async function captureFetchResponse(response, realm) {
    if (captureStopped || apply(responseBody, response, []) === null) {
      return;
    }
    const url = apply(responseURL, response, []) || realm.location.href;
    const contentType = apply(headersGet, apply(responseHeaders, response, []), ["content-type"]);
    if (!isTextResponse(url, contentType)) {
      return;
    }
    const admitted = startResponseCapture(response, url);
    if (admitted) await admitted;
  }
  function hookXHR(realm, facadeOf) {
    if (typeof realm.XMLHttpRequest !== "function") {
      return;
    }
    const NativeXMLHttpRequest = realm.XMLHttpRequest;
    const prototype = NativeXMLHttpRequest.prototype;
    function XMLHttpRequest2() {
      const xhr = construct(NativeXMLHttpRequest, arguments, new.target);
      facadeOf()?.xhrCreated(xhr, realm);
      return xhr;
    }
    setPrototypeOf(XMLHttpRequest2, getPrototypeOf(NativeXMLHttpRequest));
    const keys = ownKeys(NativeXMLHttpRequest);
    for (let index = 0; index < keys.length; index += 1) {
      defineProperty(XMLHttpRequest2, keys[index], getOwnPropertyDescriptor(NativeXMLHttpRequest, keys[index]));
    }
    defineProperty(prototype, "constructor", {
      ...getOwnPropertyDescriptor(prototype, "constructor"),
      value: XMLHttpRequest2
    });
    realm.XMLHttpRequest = XMLHttpRequest2;
  }
  function xhrCreated(xhr, realm) {
    if (captureStopped) return;
    apply(addListener, xhr, ["readystatechange", function captureXHRResponse() {
      if (captureStopped || apply(xhrReadyState, this, []) !== 4) return;
      captureXHR(this, apply(xhrResponseURL, this, []) || realm.location.href);
    }, true]);
  }
  function captureXHR(xhr, url) {
    const send = (part) => sendResponseWindow(url, "XHR", part);
    try {
      const responseType = apply(xhrResponseType, xhr, []);
      if (responseType === "" || responseType === "text") {
        void captureText(apply(xhrResponseText, xhr, []), send);
        return;
      }
      const value = apply(xhrResponse, xhr, []);
      if (value === null) return;
      if (responseType === "json") {
        void captureText(stringifyJSON(value), send);
        return;
      }
      if (!isTextResponse(url, apply(xhrResponseHeader, xhr, ["content-type"]))) return;
      if (responseType === "blob") {
        captureBlob(value, send);
      } else if (responseType === "arraybuffer") {
        void captureText(apply(textDecode, utf8Decoder, [value]), send);
      }
    } catch {
    }
  }
  function hookClipboard(realm, facadeOf) {
    const report = (text) => facadeOf()?.clipboardText(text, realm);
    const nativeSetData = realm.DataTransfer.prototype.setData;
    realm.DataTransfer.prototype.setData = {
      setData(format, data) {
        if (arguments.length < 2) return apply(nativeSetData, this, arguments);
        const formatText = `${format}`;
        const text = `${data}`;
        const result = apply(nativeSetData, this, [formatText, text]);
        if (apply(regExpExec, SET_DATA_PLAIN_TEXT_FORMAT, [formatText]) !== null) {
          report(text);
        }
        return result;
      }
    }.setData;
    const nativeAddItem = realm.DataTransferItemList.prototype.add;
    realm.DataTransferItemList.prototype.add = {
      add(data, type) {
        if (arguments.length < 2) return apply(nativeAddItem, this, arguments);
        const text = `${data}`;
        const typeText = `${type}`;
        const result = apply(nativeAddItem, this, [text, typeText]);
        if (apply(regExpExec, PLAIN_TEXT_FORMAT, [typeText]) !== null) {
          report(text);
        }
        return result;
      }
    }.add;
    const nativeExecCommand = realm.Document.prototype.execCommand;
    const getSelection = realm.Document.prototype.getSelection;
    const selectionText = realm.Selection.prototype.toString;
    const activeElementOf = getter(realm.Document.prototype, "activeElement");
    const textControl = (prototype2) => ({
      __proto__: null,
      value: getter(prototype2, "value"),
      start: getter(prototype2, "selectionStart"),
      end: getter(prototype2, "selectionEnd")
    });
    const textControls = [
      textControl(realm.HTMLTextAreaElement.prototype),
      textControl(realm.HTMLInputElement.prototype)
    ];
    const selectedText = (document2) => {
      const element = apply(activeElementOf, document2, []);
      for (let index = 0; index < textControls.length; index += 1) {
        const control = textControls[index];
        let start;
        try {
          start = apply(control.start, element, []);
        } catch {
          continue;
        }
        if (start === null) break;
        return apply(stringSlice, apply(control.value, element, []), [start, apply(control.end, element, [])]);
      }
      const selection = apply(getSelection, document2, []);
      return selection ? apply(selectionText, selection, []) : "";
    };
    realm.Document.prototype.execCommand = {
      execCommand(command) {
        if (arguments.length === 0) return apply(nativeExecCommand, this, arguments);
        const args = [`${command}`];
        for (let index = 1; index < arguments.length; index += 1) append(args, arguments[index]);
        const name = apply(stringToLowerCase, args[0], []);
        if (name === "copy") {
          const result = apply(nativeExecCommand, this, args);
          report(selectedText(this));
          return result;
        }
        if (name !== "cut") return apply(nativeExecCommand, this, args);
        const texts = [];
        const read = () => {
          const text = selectedText(this);
          for (let index = 0; index < texts.length; index += 1) if (texts[index] === text) return;
          append(texts, text);
        };
        read();
        const view = viewOf(this);
        const listeners = [];
        const listen = (target) => {
          if (!view || target !== view) return;
          const listener = () => read();
          append(listeners, listener);
          apply(addListener, view, ["cut", listener]);
        };
        const outerCut = activeCut;
        activeCut = { __proto__: null, read, listen };
        listen(view);
        try {
          return apply(nativeExecCommand, this, args);
        } finally {
          for (let index = 0; index < listeners.length; index += 1) {
            apply(removeListener, view, ["cut", listeners[index]]);
          }
          activeCut = outerCut;
          read();
          for (let index = 0; index < texts.length; index += 1) report(texts[index]);
        }
      }
    }.execCommand;
    const eventPrototype = realm.Event.prototype;
    for (let index = 0; index < EVENT_STOPPERS.length; index += 1) {
      const name = EVENT_STOPPERS[index];
      const native = eventPrototype[name];
      eventPrototype[name] = {
        [name]() {
          activeCut?.read();
          return apply(native, this, arguments);
        }
      }[name];
    }
    const cancelBubble = getOwnPropertyDescriptor(eventPrototype, "cancelBubble");
    defineProperty(eventPrototype, "cancelBubble", {
      ...cancelBubble,
      set: getOwnPropertyDescriptor({
        set cancelBubble(value) {
          if (value) activeCut?.read();
          apply(cancelBubble.set, this, [value]);
        }
      }, "cancelBubble").set
    });
    const eventTarget = realm.EventTarget.prototype;
    const nativeAddEventListener = eventTarget.addEventListener;
    eventTarget.addEventListener = {
      addEventListener() {
        const result = apply(nativeAddEventListener, this, arguments);
        activeCut?.listen(this ?? realm);
        return result;
      }
    }.addEventListener;
    if (typeof realm.Clipboard !== "function") {
      return;
    }
    const prototype = realm.Clipboard.prototype;
    const nativeWriteText = prototype.writeText;
    prototype.writeText = {
      writeText(data) {
        if (arguments.length === 0) {
          return apply(nativeWriteText, this, arguments);
        }
        let text;
        try {
          text = `${data}`;
        } catch (error) {
          return apply(promiseReject, NativePromise, [error]);
        }
        report(text);
        return apply(nativeWriteText, this, [text]);
      }
    }.writeText;
    if (typeof realm.ClipboardItem !== "function") {
      return;
    }
    const nativeWrite = prototype.write;
    prototype.write = {
      write(data) {
        if (arguments.length === 0 || data === null || typeof data !== "object" && typeof data !== "function") {
          return apply(nativeWrite, this, arguments);
        }
        const items = [];
        try {
          for (const item of data) append(items, item);
        } catch (error) {
          return apply(promiseReject, NativePromise, [error]);
        }
        const result = apply(nativeWrite, this, [listIterable(items)]);
        facadeOf()?.clipboardItems(items, realm);
        return result;
      }
    }.write;
  }
  var activeCut;
  var EVENT_STOPPERS = ["stopPropagation", "stopImmediatePropagation"];
  function listIterable(list) {
    let index = 0;
    return {
      __proto__: null,
      [iteratorSymbol]: () => ({
        __proto__: null,
        next: () => index < list.length ? { __proto__: null, done: false, value: list[index++] } : { __proto__: null, done: true, value: void 0 }
      })
    };
  }
  async function reportClipboardItems(items, realm) {
    if (captureStopped || !isArray(items) || !clipboardItemGetType) return;
    for (let index = 0; index < items.length; index += 1) {
      try {
        const blob = await own(apply(clipboardItemGetType, items[index], ["text/plain"]));
        reportClipboardText(await own(apply(blobText, blob, [])), realm);
      } catch {
      }
    }
  }
  function reportClipboardText(text, realm) {
    if (typeof text !== "string" || text.length === 0) return;
    const top = apply(windowTop, realm, []);
    if (top === null || !apply(weakSetHas, watchedPopupWindows, [top])) {
      notifyBridge({ type: PAGE_HOOK_CLIPBOARD, text });
    } else if (!captureStopped) {
      apply(dispatchEvent, window, [
        new NativeMessageEvent(popupClipboardEvent, { __proto__: null, data: text, source: top })
      ]);
    }
  }
  function reportScriptRegistered(text, base) {
    notifyBridge({ type: PAGE_HOOK_SCRIPT_URL, url: apply(urlHref, new NativeURL(text, base), []) });
  }
  function notifyBridge(message) {
    if (!captureStopped) apply(postPortMessage, bridgePort, [message]);
  }
  function bodyCaptured(body) {
    return captureStopped || apply(weakSetHas, capturedBodies, [body]);
  }
  function bodyRead(text, url, resourceType, parse, realm, RealmPromise) {
    const send = (part) => sendResponseWindow(url, resourceType, part);
    return new RealmPromise((resolve, reject) => {
      void settle(text, (value) => {
        void captureText(value, send);
        if (!parse) {
          resolve(value);
          return;
        }
        try {
          resolve(parse(value));
        } catch (error) {
          reject(error);
        }
      }, reject);
    });
  }
  var objectURLDocuments = new NativeWeakMap();
  var objectURLs = { __proto__: null };
  var objectURLsCollected = new NativeFinalizationRegistry((url) => {
    if (!objectURLEntry(url)) delete objectURLs[url];
  });
  var ObjectURLBlob = class {
    static {
      setPrototypeOf(this.prototype, null);
    }
    constructor(blob, url, owner) {
      this.blob = blob;
      this.url = url;
      this.owner = owner;
      this.encodings = [];
      this.headRead = false;
    }
    decodeAs(encoding) {
      for (let index = 0; index < this.encodings.length; index += 1) {
        if (this.encodings[index] === encoding) return;
      }
      append(this.encodings, encoding);
      if (this.headRead) captureBlob(this.blob, (part) => sendResponseWindow(this.url, "Blob", part), encoding);
    }
    forget() {
      if (objectURLEntry(this.url) === this) delete objectURLs[this.url];
      delete this.owner[this.url];
    }
  };
  function objectURLEntry(url) {
    const reference = objectURLs[url];
    return reference && apply(weakRefDeref, reference, []);
  }
  async function objectURLCreated(object, url, realm) {
    if (captureStopped) return;
    const creator = apply(windowDocument, realm, []);
    let owner = apply(weakMapGet, objectURLDocuments, [creator]);
    if (!owner) {
      owner = { __proto__: null };
      apply(weakMapSet, objectURLDocuments, [creator, owner]);
    }
    const entry = new ObjectURLBlob(object, url, owner);
    owner[url] = entry;
    objectURLs[url] = new NativeWeakRef(entry);
    apply(finalizationRegister, objectURLsCollected, [entry, url]);
    let encoding;
    let script = false;
    try {
      const head = new NativeUint8Array(8);
      let length = 0;
      const source = new StreamBytes(apply(blobStream, apply(blobSlice, object, [0, 8]), []));
      try {
        while (length < 8) {
          await own(source.ready());
          const bytes = source.take(8 - length);
          if (bytes === null) break;
          const count = apply(typedArrayByteLength, bytes, []);
          for (let index = 0; index < count; index += 1) head[length++] = bytes[index];
        }
      } finally {
        source.cancel();
      }
      encoding = head[0] === 255 && head[1] === 254 ? "utf-16le" : head[0] === 254 && head[1] === 255 ? "utf-16be" : head[0] === 239 && head[1] === 187 && head[2] === 191 ? "utf-8" : encodingOf(apply(regExpExec, CHARSET_PARAMETER, [apply(blobType, object, [])])?.[1]);
      const text = apply(textDecode, new NativeTextDecoder(encoding ?? "utf-8"), [
        new NativeUint8Array(apply(typedArrayBuffer, head, []), 0, length)
      ]);
      const code = apply(stringCharCodeAt, text, [0]);
      script = !(text.length === 0 || code === 65533 || code < 32 && (code < 9 || code > 13));
    } catch {
      entry.forget();
      return;
    }
    const captured = apply(weakSetHas, capturedBodies, [object]);
    if (encoding !== void 0) {
      entry.forget();
      if (script && !(captured && encoding === "utf-8")) captureBlob(object, (part) => sendResponseWindow(url, "Blob", part), encoding);
      return;
    }
    const wanted = entry.encodings;
    entry.encodings = ["utf-8"];
    entry.headRead = true;
    if (script && !captured) captureBlob(object, (part) => sendResponseWindow(url, "Blob", part));
    for (let index = 0; index < wanted.length; index += 1) entry.decodeAs(wanted[index]);
  }
  function blobScriptLoaded(url, encoding) {
    const name = encodingOf(encoding);
    if (name) objectURLEntry(url)?.decodeAs(name);
  }
  function objectURLRevoked(text, realm) {
    const url = `${text}`;
    const entry = objectURLEntry(url);
    if (!entry) return;
    const revokingDocument = apply(windowDocument, realm, []);
    apply(revokeObjectURL, NativeURL, [url]);
    entry.forget();
    const scripts = apply(documentQuerySelectorAll, revokingDocument, [`script[src="${url}"]`]);
    const count = apply(nodeListLength, scripts, []);
    for (let index = 0; index < count; index += 1) {
      entry.decodeAs(encodingOf(apply(elementGetAttribute, scripts[index], ["charset"])) ?? encodingOf(apply(documentCharacterSet, revokingDocument, [])));
    }
  }
  function encodingOf(label) {
    if (typeof label !== "string" || label === "") return void 0;
    try {
      return apply(textDecoderEncoding, new NativeTextDecoder(label), []);
    } catch {
      return void 0;
    }
  }
  function messageRead(event, realm) {
    if (captureStopped || !event.isTrusted || apply(weakSetHas, readMessages, [event])) return;
    const text = apply(messageEventData, event, []);
    if (typeof text !== "string" || text.length === 0) return;
    const origin = apply(messageEventOrigin, event, []);
    const source = origin === "" || origin === "null" ? realm.location.href : origin;
    apply(weakSetAdd, readMessages, [event]);
    batchText(source, "Message", text);
  }
  function scriptCompiled(text, realm) {
    pageTextCreated("Eval", text, realm);
  }
  function styleAdded(text, realm) {
    pageTextCreated("Style", text, realm);
  }
  function pageTextCreated(resourceType, text, realm) {
    if (captureStopped || typeof text !== "string" || text.length === 0) return;
    batchText(realm.location.href, resourceType, text);
  }
  function batchText(url, resourceType, text) {
    const source = `${resourceType} ${url}`;
    const seen = seenTexts[source];
    if (seen && apply(setHas, seen, [text])) return;
    textBatches[source] ??= new TextBatch(source, url, resourceType);
    textBatches[source].add(text);
  }
  function markSeen(source, text) {
    if (text.length > MAX_CAPTURE_CHARS) return;
    if (seenTextChars + text.length > MAX_CAPTURE_CHARS) {
      seenTexts = { __proto__: null };
      seenTextChars = 0;
    }
    seenTexts[source] ??= new NativeSet();
    apply(setAdd, seenTexts[source], [text]);
    seenTextChars += text.length;
  }
  var TextBatch = class {
    static {
      setPrototypeOf(this.prototype, null);
    }
    constructor(source, url, resourceType) {
      this.source = source;
      this.url = url;
      this.resourceType = resourceType;
      this.queued = new NativeSet();
      this.texts = [];
      this.timer = void 0;
      this.capturing = false;
    }
    add(text) {
      if (apply(setHas, this.queued, [text])) return;
      apply(setAdd, this.queued, [text]);
      append(this.texts, text);
      if (!this.capturing) this.timer ??= scheduleTimeout(() => this.capture(), CAPTURE_FLUSH_MS);
    }
    async capture() {
      this.timer = void 0;
      this.capturing = true;
      while (this.texts.length > 0) {
        const texts = this.texts;
        this.texts = [];
        let text = texts[0];
        for (let index = 1; index < texts.length; index += 1) text = `${text}
${texts[index]}`;
        const scanned = await own(captureText(text, (part) => sendResponseWindow(this.url, this.resourceType, part)));
        for (let index = 0; index < texts.length; index += 1) {
          apply(setDelete, this.queued, [texts[index]]);
          if (scanned) markSeen(this.source, texts[index]);
        }
      }
      this.capturing = false;
    }
  };
  function hookShadowRoots(realm, facadeOf) {
    const prototype = realm.Element.prototype;
    const nativeAttachShadow = prototype.attachShadow;
    if (typeof nativeAttachShadow !== "function") {
      return;
    }
    prototype.attachShadow = {
      attachShadow(init) {
        const root = apply(nativeAttachShadow, this, arguments);
        facadeOf()?.shadowAttached(this, root);
        return root;
      }
    }.attachShadow;
  }
  var TEXT_CONTROLS = ["HTMLInputElement", "HTMLTextAreaElement"];
  function hookTextControlValues(realm) {
    const announce = (element) => {
      try {
        registered(apply(nodeOwnerDocument, element, []), SHADOW_ROOT_KEY)?.(element);
      } catch {
      }
    };
    for (let index = 0; index < TEXT_CONTROLS.length; index += 1) {
      const prototype = realm[TEXT_CONTROLS[index]].prototype;
      wrapAccessor(prototype, "value", "set", announce);
      wrapMethod(prototype, "setRangeText", announce);
    }
  }
  function shieldThen(realm) {
    defineProperty(realm.Response.prototype, "then", { value: void 0 });
    defineProperty(realm.Blob.prototype, "then", { value: void 0 });
  }
  var CSS_INTERFACE_NAME = /^CSS/;
  var STYLE_RULES = [
    "CSSStyleRule",
    "CSSNestedDeclarations",
    "CSSPageRule",
    "CSSMarginRule",
    "CSSKeyframeRule",
    "CSSFontFaceRule",
    "CSSPositionTryRule",
    "CSSFunctionDeclarations"
  ];
  var styleProxies = new NativeWeakMap();
  var proxiedStyles = new NativeWeakMap();
  var ruleStyleMaps = new NativeWeakSet();
  var STYLE_MAP_SETTERS = ["set", "append"];
  var ATTRIBUTE_NODE = 2;
  function unwrapStyle(value) {
    return apply(weakMapGet, proxiedStyles, [value]) ?? value;
  }
  function inlineStyleCarriesText(text) {
    return apply(stringIncludes, text, ["--"]) && (apply(stringIncludes, text, ['"']) || apply(stringIncludes, text, ["'"]));
  }
  function hookStyles(realm, facadeOf) {
    const added = (text) => facadeOf()?.styleAdded(text, realm);
    const wrapText = (prototype, name, rejects) => {
      const native = prototype?.[name];
      if (typeof native !== "function") return;
      prototype[name] = {
        [name](text) {
          if (arguments.length === 0) return apply(native, this, arguments);
          let value;
          try {
            value = `${text}`;
          } catch (error) {
            if (rejects) return apply(promiseReject, NativePromise, [error]);
            throw error;
          }
          const args = [value];
          for (let index = 1; index < arguments.length; index += 1) append(args, arguments[index]);
          const result = apply(native, this, args);
          added(value);
          return result;
        }
      }[name];
    };
    const sheet = realm.CSSStyleSheet?.prototype;
    wrapText(sheet, "insertRule", false);
    wrapText(sheet, "replaceSync", false);
    wrapText(sheet, "replace", true);
    wrapText(realm.CSSGroupingRule?.prototype, "insertRule", false);
    wrapText(realm.CSSKeyframesRule?.prototype, "appendRule", false);
    const nativeAddRule = sheet?.addRule;
    if (typeof nativeAddRule === "function") {
      sheet.addRule = {
        addRule(selector, style) {
          const args = [`${selector}`, `${style}`];
          for (let index = 2; index < arguments.length; index += 1) append(args, arguments[index]);
          const result = apply(nativeAddRule, this, args);
          added(`${args[0]}{${args[1]}}`);
          return result;
        }
      }.addRule;
    }
    const counterStyle = realm.CSSCounterStyleRule?.prototype;
    const descriptors = counterStyle ? ownKeys(counterStyle) : [];
    for (let index = 0; index < descriptors.length; index += 1) {
      const name = descriptors[index];
      const descriptor = typeof name === "string" && getOwnPropertyDescriptor(counterStyle, name);
      if (!descriptor?.set) continue;
      defineProperty(counterStyle, name, {
        ...descriptor,
        set: getOwnPropertyDescriptor({
          set [name](value) {
            const text = `${value}`;
            apply(descriptor.set, this, [text]);
            added(`${name}: ${text}`);
          }
        }, name).set
      });
    }
    const declaration = realm.CSSStyleDeclaration.prototype;
    const nativeSetProperty = declaration.setProperty;
    const cssText = getOwnPropertyDescriptor(declaration, "cssText");
    const acceptProxy = (prototype) => {
      const members = ownKeys(prototype);
      for (let index = 0; index < members.length; index += 1) {
        const name = members[index];
        if (typeof name !== "string" || name === "constructor" || name === "setProperty") continue;
        const descriptor = getOwnPropertyDescriptor(prototype, name);
        if (typeof descriptor.value === "function") {
          const native = descriptor.value;
          prototype[name] = {
            [name]() {
              return apply(native, unwrapStyle(this), arguments);
            }
          }[name];
          continue;
        }
        if (!descriptor.get) continue;
        const accessors = {
          get [name]() {
            return apply(descriptor.get, unwrapStyle(this), []);
          },
          set [name](value) {
            apply(descriptor.set, unwrapStyle(this), [value]);
          }
        };
        defineProperty(prototype, name, {
          ...descriptor,
          get: getOwnPropertyDescriptor(accessors, name).get,
          ...descriptor.set ? { set: getOwnPropertyDescriptor(accessors, name).set } : {}
        });
      }
    };
    acceptProxy(declaration);
    const globals = ownKeys(realm);
    for (let index = 0; index < globals.length; index += 1) {
      const name = globals[index];
      if (typeof name !== "string" || apply(regExpExec, CSS_INTERFACE_NAME, [name]) === null) continue;
      const prototype = getOwnPropertyDescriptor(realm, name)?.value?.prototype;
      if (prototype && prototype !== declaration && apply(isPrototypeOf, declaration, [prototype])) {
        acceptProxy(prototype);
      }
    }
    const parentRule = getter(declaration, "parentRule");
    const declared = (target, text) => {
      if (apply(parentRule, target, []) !== null || inlineStyleCarriesText(text)) added(text);
    };
    declaration.setProperty = {
      setProperty(property, value) {
        const target = unwrapStyle(this);
        if (arguments.length < 2) return apply(nativeSetProperty, target, arguments);
        const args = [`${property}`, value === null ? "" : `${value}`];
        for (let index = 2; index < arguments.length; index += 1) append(args, arguments[index]);
        const result = apply(nativeSetProperty, target, args);
        declared(target, `${args[0]}: ${args[1]}`);
        return result;
      }
    }.setProperty;
    const nativeCSSText = cssText.set;
    defineProperty(declaration, "cssText", {
      ...getOwnPropertyDescriptor(declaration, "cssText"),
      set: getOwnPropertyDescriptor({
        set cssText(value) {
          const text = `${value}`;
          const target = unwrapStyle(this);
          apply(nativeCSSText, target, [text]);
          declared(target, text);
        }
      }, "cssText").set
    });
    const cssProperty = (target, key) => {
      if (typeof key !== "string") return false;
      const ownDescriptor = getOwnPropertyDescriptor(target, key);
      if (ownDescriptor) return typeof ownDescriptor.value === "string";
      const prototype = getPrototypeOf(target);
      return prototype !== declaration && getOwnPropertyDescriptor(prototype, key)?.set !== void 0;
    };
    const handler = freeze({
      __proto__: null,
      set(target, key, value, receiver) {
        if (!cssProperty(target, key)) return reflectSet(target, key, value, receiver);
        const text = value === null ? "" : `${value}`;
        const result = reflectSet(target, key, text, target);
        added(`${key}: ${text}`);
        return result;
      },
      defineProperty(target, key, descriptor) {
        const value = getOwnPropertyDescriptor(descriptor, "value");
        if (!value || !cssProperty(target, key)) return defineProperty(target, key, descriptor);
        const text = value.value === null ? "" : `${value.value}`;
        const result = defineProperty(target, key, { ...descriptor, value: text });
        added(`${key}: ${text}`);
        return result;
      }
    });
    const proxied = (target) => {
      let proxy = apply(weakMapGet, styleProxies, [target]);
      if (!proxy) {
        proxy = new NativeProxy(target, handler);
        apply(weakMapSet, styleProxies, [target, proxy]);
        apply(weakMapSet, proxiedStyles, [proxy, target]);
      }
      return proxy;
    };
    for (let index = 0; index < STYLE_RULES.length; index += 1) {
      const prototype = realm[STYLE_RULES[index]]?.prototype;
      const descriptor = prototype && getOwnPropertyDescriptor(prototype, "style");
      if (!descriptor?.get) continue;
      const nativeStyle = descriptor.get;
      defineProperty(prototype, "style", {
        ...descriptor,
        get: getOwnPropertyDescriptor({
          get style() {
            return proxied(apply(nativeStyle, this, []));
          }
        }, "style").get
      });
    }
    const styleMapDescriptor = getOwnPropertyDescriptor(realm.CSSStyleRule.prototype, "styleMap");
    if (styleMapDescriptor?.get) {
      const nativeStyleMap = styleMapDescriptor.get;
      defineProperty(realm.CSSStyleRule.prototype, "styleMap", {
        ...styleMapDescriptor,
        get: getOwnPropertyDescriptor({
          get styleMap() {
            const map = apply(nativeStyleMap, this, []);
            apply(weakSetAdd, ruleStyleMaps, [map]);
            return map;
          }
        }, "styleMap").get
      });
    }
    const styleMap = realm.StylePropertyMap?.prototype;
    const styleValueText = realm.CSSStyleValue?.prototype.toString;
    for (let index = 0; index < STYLE_MAP_SETTERS.length; index += 1) {
      const name = STYLE_MAP_SETTERS[index];
      const native = styleMap?.[name];
      if (typeof native !== "function") continue;
      styleMap[name] = {
        [name](property) {
          if (arguments.length === 0) return apply(native, this, arguments);
          const args = [`${property}`];
          let text = `${args[0]}:`;
          for (let index2 = 1; index2 < arguments.length; index2 += 1) {
            let value = arguments[index2];
            try {
              text += ` ${apply(styleValueText, value, [])}`;
            } catch {
              value = `${value}`;
              text += ` ${value}`;
            }
            append(args, value);
          }
          const result = apply(native, this, args);
          if (apply(weakSetHas, ruleStyleMaps, [this]) || inlineStyleCarriesText(text)) added(text);
          return result;
        }
      }[name];
    }
    const inlineStyle = (text) => {
      if (inlineStyleCarriesText(text)) added(text);
    };
    const isStyleName = (name) => name.length === 5 && apply(stringToLowerCase, name, []) === "style";
    const element = realm.Element.prototype;
    const nativeSetAttribute = element.setAttribute;
    element.setAttribute = {
      setAttribute(name, value) {
        if (arguments.length < 2) return apply(nativeSetAttribute, this, arguments);
        const nameText = `${name}`;
        if (!isStyleName(nameText)) return apply(nativeSetAttribute, this, [nameText, value]);
        const text = `${value}`;
        const result = apply(nativeSetAttribute, this, [nameText, text]);
        inlineStyle(text);
        return result;
      }
    }.setAttribute;
    const nativeSetAttributeNS = element.setAttributeNS;
    element.setAttributeNS = {
      setAttributeNS(namespace, name, value) {
        if (arguments.length < 3) return apply(nativeSetAttributeNS, this, arguments);
        const namespaceText = namespace === null || namespace === void 0 ? null : `${namespace}`;
        const nameText = `${name}`;
        if (namespaceText !== null && namespaceText !== "" || !isStyleName(nameText)) {
          return apply(nativeSetAttributeNS, this, [namespaceText, nameText, value]);
        }
        const text = `${value}`;
        const result = apply(nativeSetAttributeNS, this, [namespaceText, nameText, text]);
        inlineStyle(text);
        return result;
      }
    }.setAttributeNS;
    const nodeType = getter(realm.Node.prototype, "nodeType");
    const attributeName = getter(realm.Attr.prototype, "name");
    const attributeValue = (prototype, name, nullable) => {
      const descriptor = getOwnPropertyDescriptor(prototype, name);
      defineProperty(prototype, name, {
        ...descriptor,
        set: getOwnPropertyDescriptor({
          set [name](value) {
            if (apply(nodeType, this, []) !== ATTRIBUTE_NODE || !isStyleName(apply(attributeName, this, []))) {
              apply(descriptor.set, this, [value]);
              return;
            }
            const text = nullable && (value === null || value === void 0) ? "" : `${value}`;
            apply(descriptor.set, this, [text]);
            inlineStyle(text);
          }
        }, name).set
      });
    };
    attributeValue(realm.Attr.prototype, "value", false);
    attributeValue(realm.Node.prototype, "nodeValue", true);
    attributeValue(realm.Node.prototype, "textContent", true);
  }
  function hookBodyReads(realm, facadeOf) {
    const RealmPromise = realm.Promise;
    const response = realm.Response.prototype;
    const nativeClone = response.clone;
    response.clone = {
      clone() {
        const captured = apply(weakSetHas, capturedBodies, [this]);
        const body = captured ? apply(responseBody, this, []) : null;
        const clone = apply(nativeClone, this, arguments);
        if (!captured) return clone;
        apply(weakSetAdd, capturedBodies, [clone]);
        if (body) {
          apply(weakMapGet, pageBranches, [body])?.replace(body, [
            apply(responseBody, this, []),
            apply(responseBody, clone, [])
          ]);
        }
        return clone;
      }
    }.clone;
    const parseJSON = realm.JSON.parse;
    const parse = (text) => apply(parseJSON, void 0, [text]);
    const read = (prototype, name, source, json) => {
      const native = prototype[name];
      const nativeText = prototype.text;
      prototype[name] = {
        [name]() {
          const facade = facadeOf();
          if (!facade || facade.bodyCaptured(this)) return apply(native, this, arguments);
          const text = apply(nativeText, this, []);
          const { url, resourceType } = source(this);
          return facade.bodyRead(text, url, resourceType, json ? parse : void 0, realm, RealmPromise) ?? text;
        }
      }[name];
    };
    const pageSource = () => ({ __proto__: null, url: realm.location.href, resourceType: "Blob" });
    const responseSource = (target) => {
      let url = "";
      try {
        url = apply(responseURL, target, []);
      } catch {
      }
      return url ? { __proto__: null, url, resourceType: "Fetch" } : pageSource();
    };
    read(response, "text", responseSource, false);
    read(response, "json", responseSource, true);
    read(realm.Blob.prototype, "text", pageSource, false);
  }
  function hookPageBranches(realm) {
    const stream = realm.ReadableStream.prototype;
    const nativeCancel = stream.cancel;
    stream.cancel = {
      cancel() {
        const branches = apply(weakMapGet, pageBranches, [this]);
        const unlocked = branches !== void 0 && !apply(streamLocked, this, []);
        const result = apply(nativeCancel, this, arguments);
        if (unlocked) branches.replace(this, []);
        return result;
      }
    }.cancel;
    const nativeTee = stream.tee;
    stream.tee = {
      tee() {
        const result = apply(nativeTee, this, arguments);
        apply(weakMapGet, pageBranches, [this])?.replace(this, [result[0], result[1]]);
        return result;
      }
    }.tee;
    const nativeGetReader = stream.getReader;
    stream.getReader = {
      getReader() {
        const reader = apply(nativeGetReader, this, arguments);
        if (apply(weakMapGet, pageBranches, [this])) apply(weakMapSet, branchReaders, [reader, this]);
        return reader;
      }
    }.getReader;
    for (let index = 0; index < READER_INTERFACES.length; index += 1) {
      const prototype = realm[READER_INTERFACES[index]]?.prototype;
      if (!prototype) continue;
      const nativeReaderCancel = prototype.cancel;
      prototype.cancel = {
        cancel() {
          const stream2 = apply(weakMapGet, branchReaders, [this]);
          const result = apply(nativeReaderCancel, this, arguments);
          if (stream2) apply(weakMapGet, pageBranches, [stream2])?.replace(stream2, []);
          return result;
        }
      }.cancel;
      const nativeReleaseLock = prototype.releaseLock;
      prototype.releaseLock = {
        releaseLock() {
          apply(nativeReleaseLock, this, arguments);
          apply(weakMapDelete, branchReaders, [this]);
        }
      }.releaseLock;
    }
  }
  function hookObjectURLs(realm, facadeOf) {
    const nativeCreateObjectURL = realm.URL.createObjectURL;
    realm.URL.createObjectURL = {
      createObjectURL(object) {
        const url = apply(nativeCreateObjectURL, this, arguments);
        facadeOf()?.objectURLCreated(object, url, realm);
        return url;
      }
    }.createObjectURL;
    const nativeRevokeObjectURL = realm.URL.revokeObjectURL;
    realm.URL.revokeObjectURL = {
      revokeObjectURL(url) {
        if (arguments.length === 0) return apply(nativeRevokeObjectURL, this, arguments);
        const text = `${url}`;
        const result = apply(nativeRevokeObjectURL, this, [text]);
        facadeOf()?.objectURLRevoked(text, realm);
        return result;
      }
    }.revokeObjectURL;
  }
  function hookServiceWorkers(realm, facadeOf) {
    const prototype = realm.ServiceWorkerContainer?.prototype;
    if (!prototype) return;
    const nativeRegister = prototype.register;
    prototype.register = {
      register(scriptURL) {
        if (arguments.length === 0) return apply(nativeRegister, this, arguments);
        let url = scriptURL;
        let text;
        try {
          text = apply(trustedScriptURLText, scriptURL, []);
        } catch {
          try {
            text = url = `${scriptURL}`;
          } catch (error) {
            return apply(promiseReject, NativePromise, [error]);
          }
        }
        facadeOf()?.scriptRegistered(text, apply(nodeBaseURI, apply(windowDocument, realm, []), []));
        return apply(nativeRegister, this, [url, arguments[1]]);
      }
    }.register;
  }
  function hookMessages(realm, facadeOf) {
    const prototype = realm.MessageEvent.prototype;
    const descriptor = getOwnPropertyDescriptor(prototype, "data");
    const nativeData = descriptor.get;
    defineProperty(prototype, "data", {
      ...descriptor,
      get: getOwnPropertyDescriptor({
        get data() {
          const data = apply(nativeData, this, []);
          if (typeof data === "string" && data.length > 0) facadeOf()?.messageRead(this, realm);
          return data;
        }
      }, "data").get
    });
  }
  var SCRIPT_SINK_MARKER = "clicknix-tt";
  var POLICY_MEMBERS = ["createHTML", "createScript", "createScriptURL"];
  var TRUSTED_TYPE_NAMES = {
    __proto__: null,
    createHTML: "TrustedHTML",
    createScript: "TrustedScript",
    createScriptURL: "TrustedScriptURL"
  };
  var HTTP_URL = /^https?:/i;
  var TRUSTED_TYPES_META = 'meta[http-equiv="content-security-policy" i][content*="require-trusted-types-for" i]';
  var sinkDocuments = new NativeWeakMap();
  var sinkPolicies = new NativeWeakMap();
  function hookScriptSinks(realm, facadeOf) {
    const factory = realm.trustedTypes;
    const prototype = realm.TrustedTypePolicyFactory?.prototype;
    if (!factory || !prototype) return;
    const nativeCreatePolicy = prototype.createPolicy;
    const compiled = (text) => facadeOf()?.scriptCompiled(text, realm);
    if (sinksPass(realm)) {
      const state = { __proto__: null, policy: null, page: null };
      const member = (name) => ({
        // Chrome calls a default policy for a sink with the value, the trusted
        // type name and the sink; a page calls the policy it created directly.
        // Where sinks pass, a page's own default policy still applies, as under
        // its own report-only header (it may sanitize): its result is used, and
        // a value it returns null or undefined for passes unchanged, unreported.
        [name](input, typeName) {
          const sinkCall = typeName === TRUSTED_TYPE_NAMES[name];
          const pageMember = state.page?.[name];
          if (sinkCall && sinksPass(realm)) {
            const value = pageMember ? apply(pageMember, this, arguments) : void 0;
            if (value !== void 0 && value !== null) return value;
            if (name === "createScript") compiled(input);
            return input;
          }
          if (pageMember) return apply(pageMember, this, arguments);
          if (sinkCall) return null;
          throw new NativeTypeError(`Policy default's TrustedTypePolicyOptions did not specify a '${name}' member.`);
        }
      })[name];
      try {
        state.policy = apply(nativeCreatePolicy, factory, ["default", {
          __proto__: null,
          createHTML: member("createHTML"),
          createScript: member("createScript"),
          createScriptURL: member("createScriptURL")
        }]);
        apply(weakMapSet, sinkPolicies, [factory, state]);
      } catch {
      }
    }
    prototype.createPolicy = {
      createPolicy(name, options) {
        if (arguments.length === 0) return apply(nativeCreatePolicy, this, arguments);
        const policyName = `${name}`;
        const members = policyMembers(options, compiled);
        const state = apply(weakMapGet, sinkPolicies, [this]);
        if (!state || policyName !== "default" || typeof members !== "object") {
          return apply(nativeCreatePolicy, this, [policyName, members]);
        }
        if (state.page) throw new NativeTypeError('Policy with name "default" already exists.');
        for (let index = 0; index < POLICY_MEMBERS.length; index += 1) {
          const value = members[POLICY_MEMBERS[index]];
          if (value !== void 0 && typeof value !== "function") {
            throw new NativeTypeError(`The provided value is not of type '${POLICY_MEMBERS[index]}'.`);
          }
        }
        state.page = members;
        return state.policy;
      }
    }.createPolicy;
    const descriptor = getOwnPropertyDescriptor(prototype, "defaultPolicy");
    const nativeDefaultPolicy = descriptor.get;
    defineProperty(prototype, "defaultPolicy", {
      ...descriptor,
      get: getOwnPropertyDescriptor({
        get defaultPolicy() {
          const state = apply(weakMapGet, sinkPolicies, [this]);
          if (!state) return apply(nativeDefaultPolicy, this, []);
          return state.page ? state.policy : null;
        }
      }, "defaultPolicy").get
    });
  }
  function policyMembers(options, compiled) {
    const members = { __proto__: null };
    if (options === void 0 || options === null) return members;
    if (typeof options !== "object" && typeof options !== "function") return options;
    for (let index = 0; index < POLICY_MEMBERS.length; index += 1) {
      const name = POLICY_MEMBERS[index];
      const value = options[name];
      members[name] = name === "createScript" && typeof value === "function" ? function createScript() {
        const script = apply(value, this, arguments);
        if (script === void 0 || script === null) return script;
        const text = `${script}`;
        compiled(text);
        return text;
      } : value;
    }
    return members;
  }
  function sinksPass(view) {
    let viewDocument;
    try {
      viewDocument = apply(windowDocument, view, []);
    } catch {
      return false;
    }
    let state = apply(weakMapGet, sinkDocuments, [viewDocument]);
    if (!state) {
      state = { __proto__: null, passes: false, head: null, count: 0 };
      apply(weakMapSet, sinkDocuments, [viewDocument, state]);
      state.passes = reportOnlyPolicyApplies(view, viewDocument);
    }
    if (state.passes) {
      const head = apply(documentHead, viewDocument, []);
      const count = head ? apply(elementChildCount, head, []) : 0;
      if (head !== state.head || count !== state.count) {
        state.head = head;
        state.count = count;
        if (head && apply(querySelector, head, [TRUSTED_TYPES_META]) !== null) {
          state.passes = false;
          state.passes = trustedTypesUnenforced(viewDocument);
        }
      }
    }
    return state.passes;
  }
  function reportOnlyPolicyApplies(view, viewDocument) {
    const url = apply(documentURL, viewDocument, []);
    if (apply(regExpExec, HTTP_URL, [url]) === null) {
      const parent = apply(windowParent, view, []);
      const creator = parent !== view ? parent : apply(windowOpener, view, []);
      try {
        if (creator && apply(windowDocument, creator, [])) return sinksPass(creator);
      } catch {
      }
      return url !== "about:blank" && trustedTypesUnenforced(viewDocument);
    }
    const navigation = apply(performanceEntriesByType, apply(windowPerformance, view, []), ["navigation"]);
    const timings = navigation.length > 0 ? apply(serverTimingOf, navigation[0], []) : [];
    for (let index = 0; index < timings.length; index += 1) {
      if (apply(serverTimingName, timings[index], []) === SCRIPT_SINK_MARKER) return true;
    }
    return false;
  }
  function trustedTypesUnenforced(viewDocument) {
    const root = apply(documentElementOf, viewDocument, []);
    if (!root) return false;
    const frame = apply(createElementNS, viewDocument, [HTML_NAMESPACE, "iframe"]);
    apply(appendChild, root, [frame]);
    const probe = apply(frameContentWindow, frame, []);
    apply(removeElement, frame, []);
    try {
      apply(probe.setTimeout, probe, [""]);
      return true;
    } catch {
      return false;
    }
  }
  var FRAME_WINDOW_GETTERS = [
    ["HTMLIFrameElement", ["contentWindow"]],
    ["HTMLFrameElement", ["contentWindow"]],
    ["HTMLObjectElement", ["contentWindow"]]
  ];
  var FRAME_DOCUMENT_GETTERS = [
    ["HTMLIFrameElement", ["contentDocument"]],
    ["HTMLFrameElement", ["contentDocument"]],
    ["HTMLObjectElement", ["contentDocument"]]
  ];
  var FRAME_DOCUMENT_METHODS = [
    ["HTMLIFrameElement", ["getSVGDocument"]],
    ["HTMLObjectElement", ["getSVGDocument"]],
    ["HTMLEmbedElement", ["getSVGDocument"]]
  ];
  var FRAME_METHODS = [
    ["Node", ["appendChild", "insertBefore", "replaceChild"]],
    ["Element", [
      "append",
      "prepend",
      "after",
      "before",
      "replaceWith",
      "replaceChildren",
      "insertAdjacentElement",
      "insertAdjacentHTML",
      "setHTMLUnsafe"
    ]],
    ["CharacterData", ["after", "before", "replaceWith"]],
    ["DocumentType", ["after", "before", "replaceWith"]],
    ["Document", ["append", "prepend", "replaceChildren", "write", "writeln", "execCommand"]],
    ["DocumentFragment", ["append", "prepend", "replaceChildren"]],
    ["ShadowRoot", ["setHTMLUnsafe"]]
  ];
  var RANGE_METHODS = ["insertNode", "surroundContents"];
  var FRAME_SELECTOR = "iframe, frame, object";
  var FRAME_SETTERS = [
    ["Element", ["innerHTML", "outerHTML"]],
    ["ShadowRoot", ["innerHTML"]]
  ];
  var reachedWindows = new NativeWeakSet();
  var shadowFrames = [];
  var shadowFrameSet = new NativeWeakSet();
  var pipelineFacade;
  var capturedBodies = new NativeWeakSet();
  var readMessages = new NativeWeakSet();
  var textBatches = { __proto__: null };
  var seenTexts = { __proto__: null };
  var seenTextChars = 0;
  function hookFrameAccess(realm, facadeOf) {
    const adoptFramesAfter = (target) => {
      const view = viewOf(target);
      const facade = view && windowFacade(view);
      facade?.adoptFrames(view);
      facade?.adoptShadowFrames(target);
    };
    const adoptHandedOut = (toWindow) => (element, value) => {
      const view = viewOf(element);
      if (view && value) windowFacade(view)?.adoptFrame(toWindow(value));
    };
    const adoptWindowHandedOut = adoptHandedOut((child) => child);
    const adoptDocumentHandedOut = adoptHandedOut((child) => apply(documentDefaultView, child, []));
    forEachMember(realm, FRAME_WINDOW_GETTERS, (prototype, name) => {
      wrapAccessor(prototype, name, "get", adoptWindowHandedOut);
    });
    forEachMember(realm, FRAME_DOCUMENT_GETTERS, (prototype, name) => {
      wrapAccessor(prototype, name, "get", adoptDocumentHandedOut);
    });
    forEachMember(realm, FRAME_DOCUMENT_METHODS, (prototype, name) => {
      wrapMethod(prototype, name, adoptDocumentHandedOut);
    });
    forEachMember(realm, FRAME_METHODS, (prototype, name) => {
      wrapMethod(prototype, name, adoptFramesAfter);
    });
    forEachMember(realm, FRAME_SETTERS, (prototype, name) => {
      wrapAccessor(prototype, name, "set", adoptFramesAfter);
    });
    const rangePrototype = realm.Range.prototype;
    for (let index = 0; index < RANGE_METHODS.length; index += 1) {
      wrapMethod(rangePrototype, RANGE_METHODS[index], (range) => {
        adoptFramesAfter(apply(rangeContainer, range, []));
      });
    }
    const wrapOpen = (target, minArguments) => {
      const native = target?.open;
      if (typeof native !== "function") return;
      target.open = {
        open(url) {
          if (arguments.length < minArguments) return apply(native, this, arguments);
          const args = [];
          for (let index = 0; index < arguments.length; index += 1) append(args, arguments[index]);
          if (args.length > 0 && args[0] !== void 0) args[0] = `${args[0]}`;
          const opened = apply(native, this, args);
          if (opened) facadeOf()?.popupOpened(opened, args[0] ?? "", realm);
          return opened;
        }
      }.open;
    };
    wrapOpen(realm, 0);
    wrapOpen(realm.Document.prototype, 3);
  }
  function forEachMember(realm, table, wrap) {
    for (let entry = 0; entry < table.length; entry += 1) {
      const prototype = realm[table[entry][0]]?.prototype;
      if (!prototype) continue;
      const names = table[entry][1];
      for (let index = 0; index < names.length; index += 1) wrap(prototype, names[index]);
    }
  }
  function wrapMethod(prototype, name, after) {
    const native = prototype[name];
    if (typeof native !== "function") return;
    prototype[name] = {
      [name]() {
        let result;
        try {
          result = apply(native, this, arguments);
          return result;
        } finally {
          after(this, result);
        }
      }
    }[name];
  }
  function wrapAccessor(prototype, name, kind, after) {
    const descriptor = getOwnPropertyDescriptor(prototype, name);
    const native = descriptor?.[kind];
    if (!native) return;
    const wrappers = {
      get [name]() {
        const value = apply(native, this, []);
        after(this, value);
        return value;
      },
      set [name](value) {
        try {
          apply(native, this, [value]);
        } finally {
          after(this);
        }
      }
    };
    defineProperty(prototype, name, {
      ...descriptor,
      [kind]: getOwnPropertyDescriptor(wrappers, name)[kind]
    });
  }
  function viewOf(target) {
    try {
      return apply(documentDefaultView, apply(nodeOwnerDocument, target, []) ?? target, []);
    } catch {
      return null;
    }
  }
  function adoptFrames(view) {
    if (!view) return;
    let count;
    try {
      count = apply(windowLength, view, []);
    } catch {
      return;
    }
    for (let index = 0; index < count; index += 1) adoptFrame(view[index]);
  }
  function adoptShadowFrames(node) {
    const root = apply(getRootNode, node, []);
    if (apply(nodeTypeOf, root, []) === DOCUMENT_FRAGMENT_NODE && apply(getRootNode, root, [COMPOSED]) !== root) {
      const frames = apply(fragmentQuerySelectorAll, root, [FRAME_SELECTOR]);
      const count = apply(nodeListLength, frames, []);
      for (let index = 0; index < count; index += 1) {
        const frame = frames[index];
        if (apply(weakSetHas, shadowFrameSet, [frame])) continue;
        apply(weakSetAdd, shadowFrameSet, [frame]);
        append(shadowFrames, new NativeWeakRef(frame));
      }
    }
    for (let index = 0; index < shadowFrames.length; ) {
      const frame = apply(weakRefDeref, shadowFrames[index], []);
      if (frame) {
        adoptFrame(frameWindow(frame));
        index += 1;
      } else {
        removeAt(shadowFrames, index);
      }
    }
  }
  function frameWindow(frame) {
    const windowGetter = frameWindowGetters[apply(elementLocalName, frame, [])];
    try {
      return apply(windowGetter, frame, []);
    } catch {
      return null;
    }
  }
  function adoptFrame(child) {
    if (!child || apply(weakSetHas, reachedWindows, [child])) return;
    apply(weakSetAdd, reachedWindows, [child]);
    adoptWindow(child);
  }
  function adoptWindow(candidate) {
    let candidateDocument;
    try {
      candidateDocument = apply(windowDocument, candidate, []);
    } catch {
      return;
    }
    if (!candidateDocument || !register(candidateDocument, pipelineFacade)) return;
    if (register(candidate, pipelineFacade)) hookRealm(candidate);
    if (apply(documentReadyState, candidateDocument, []) === "loading") {
      observeParsedFrames(candidate, candidateDocument);
    }
  }
  function popupOpened(popup, url, realm) {
    let popupDocument;
    try {
      popupDocument = apply(windowDocument, popup, []);
    } catch {
      return;
    }
    const reached = registered(popupDocument) !== void 0;
    adoptWindow(popup);
    if (reached || apply(windowParent, popup, []) !== popup || apply(documentURL, popupDocument, []) !== "about:blank") {
      return;
    }
    let target = "";
    if (url !== "") {
      try {
        target = apply(urlHref, new NativeURL(url, apply(nodeBaseURI, apply(windowDocument, realm, []), [])), []);
      } catch {
        return;
      }
    }
    apply(weakSetAdd, watchedPopupWindows, [popup]);
    watchPopup(popupDocument, target === "" || target === "about:blank" ? realm.location.href : target);
  }
  var POPUP_OBSERVER_OPTIONS = freeze({
    __proto__: null,
    attributes: true,
    characterData: true,
    childList: true,
    subtree: true
  });
  var watchedPopups = new NativeWeakMap();
  var watchedPopupWindows = new NativeWeakSet();
  function watchPopup(popupDocument, url) {
    let due = false;
    let capturing = false;
    let captured = "";
    const roots = [];
    const capture = async () => {
      due = false;
      capturing = true;
      try {
        const root = apply(documentElementOf, popupDocument, []);
        const text = root ? popupMarkup(root, roots) : "";
        if (text !== captured) {
          captured = text;
          await own(captureText(text, (part) => sendResponseWindow(url, "Popup", part)));
        }
      } finally {
        capturing = false;
        if (due) scheduleTimeout(capture, CAPTURE_FLUSH_MS);
      }
    };
    const observer = new NativeMutationObserver(() => {
      if (due || captureStopped) return;
      due = true;
      if (!capturing) scheduleTimeout(capture, CAPTURE_FLUSH_MS);
    });
    apply(observeMutations, observer, [popupDocument, POPUP_OBSERVER_OPTIONS]);
    apply(weakMapSet, watchedPopups, [popupDocument, { __proto__: null, roots, observer }]);
  }
  function popupShadowAttached(host, root) {
    if (apply(shadowRootHost, root, []) !== host) return;
    const watch = apply(weakMapGet, watchedPopups, [apply(nodeOwnerDocument, host, [])]);
    if (!watch) return;
    append(watch.roots, root);
    apply(observeMutations, watch.observer, [root, POPUP_OBSERVER_OPTIONS]);
  }
  function popupMarkup(root, shadowRoots) {
    const inner = apply(elementGetHTML, root, [{
      __proto__: null,
      serializableShadowRoots: true,
      shadowRoots: listIterable(shadowRoots)
    }]);
    const shell = apply(elementOuterHTML, apply(cloneNode, root, [false]), []);
    const endTag = `</${apply(elementLocalName, root, [])}>`;
    return apply(stringEndsWith, shell, [endTag]) ? `${apply(stringSlice, shell, [0, shell.length - endTag.length])}${inner}${endTag}` : `${shell}${inner}`;
  }
  var PARSED_FRAME_OBSERVER_OPTIONS = freeze({ __proto__: null, childList: true, subtree: true });
  var ONCE = freeze({ __proto__: null, once: true });
  function observeParsedFrames(view, observedDocument) {
    const observer = new NativeMutationObserver(() => {
      adoptFrames(view);
      adoptShadowFrames(observedDocument);
    });
    apply(observeMutations, observer, [observedDocument, PARSED_FRAME_OBSERVER_OPTIONS]);
    apply(addListener, observedDocument, ["DOMContentLoaded", () => {
      apply(disconnectObserver, observer, []);
    }, ONCE]);
  }
  function hookRealm(realm) {
    const facadeOf = () => windowFacade(realm);
    hookFetch(realm, facadeOf);
    hookXHR(realm, facadeOf);
    hookClipboard(realm, facadeOf);
    hookShadowRoots(realm, facadeOf);
    hookTextControlValues(realm);
    hookBodyReads(realm, facadeOf);
    hookPageBranches(realm);
    hookObjectURLs(realm, facadeOf);
    hookServiceWorkers(realm, facadeOf);
    hookMessages(realm, facadeOf);
    hookScriptSinks(realm, facadeOf);
    hookStyles(realm, facadeOf);
    hookFrameAccess(realm, facadeOf);
    shieldThen(realm);
  }
  function windowFacade(view) {
    try {
      return registered(apply(windowDocument, view, []));
    } catch {
      return void 0;
    }
  }
  function register(target, value, key = HOOK_KEY) {
    try {
      defineProperty(target, key, { value });
      return true;
    } catch {
      return false;
    }
  }
  function registered(target, key = HOOK_KEY) {
    const descriptor = getOwnPropertyDescriptor(target, key);
    return descriptor && !descriptor.configurable ? descriptor.value : void 0;
  }
  function clusterFacade() {
    if (window.top === window) return void 0;
    const facade = registered(window);
    if (facade) return facade;
    try {
      return registered(apply(windowDocument, window.parent, []));
    } catch {
      return void 0;
    }
  }
  async function captureText(text, send) {
    if (captureStopped || typeof text !== "string" || text.length === 0) return false;
    let lease;
    try {
      lease = await own(captureMemory.lease(CAPTURE_MEMORY_MINIMUM));
      const capture = new TextCapture(lease, send);
      await own(capture.write(text));
      await own(capture.finish());
      return capture.scanned;
    } catch {
      return false;
    } finally {
      lease?.release();
    }
  }
  function startResponseCapture(response, url) {
    let clone;
    try {
      clone = apply(responseClone, response, []);
    } catch {
      return void 0;
    }
    apply(weakSetAdd, capturedBodies, [response]);
    const branches = new PageBranches(apply(responseBody, response, []));
    let resolveAdmission;
    const admitted = own(new NativePromise((resolve) => {
      resolveAdmission = resolve;
    }));
    void captureStream(
      () => branches.opened(new StreamTextReader(apply(responseBody, clone, []))),
      CAPTURE_MEMORY_RESERVATION,
      (part) => sendResponseWindow(url, "Fetch", part),
      resolveAdmission
    );
    return admitted;
  }
  var PageBranches = class {
    static {
      setPrototypeOf(this.prototype, null);
    }
    constructor(body) {
      this.count = 0;
      this.abandoned = false;
      this.reader = null;
      this.add(body);
    }
    add(stream) {
      apply(weakMapSet, pageBranches, [stream, this]);
      this.count += 1;
    }
    // The stream was canceled, or split into the given streams.
    replace(stream, streams) {
      if (!apply(weakMapDelete, pageBranches, [stream])) return;
      this.count -= 1;
      for (let index = 0; index < streams.length; index += 1) this.add(streams[index]);
      if (this.count > 0) return;
      this.abandoned = true;
      this.reader?.drain();
    }
    opened(reader) {
      this.reader = reader;
      if (this.abandoned) reader.drain();
      return reader;
    }
  };
  var pageBranches = new NativeWeakMap();
  var branchReaders = new NativeWeakMap();
  var READER_INTERFACES = ["ReadableStreamDefaultReader", "ReadableStreamBYOBReader"];
  function captureBlob(blob, send, encoding = "utf-8") {
    if (encoding === "utf-8") apply(weakSetAdd, capturedBodies, [blob]);
    void captureStream(
      () => new StreamTextReader(apply(blobStream, blob, []), encoding),
      CAPTURE_MEMORY_MINIMUM,
      send
    );
  }
  async function captureStream(openReader, leaseSize, send, resolveAdmission = () => {
  }) {
    let lease;
    let reader;
    let finished = false;
    try {
      lease = await own(captureMemory.lease(leaseSize));
      resolveAdmission();
      reader = openReader();
      const capture = new TextCapture(lease, send);
      lease.shrink(capture.retainedBytes());
      try {
        let read = own(reader.read());
        while (!captureStopped) {
          const text = await own(settleOrFlushDue(read, capture.flushDelay()));
          if (text === FLUSH_DUE) {
            await own(capture.flush());
            continue;
          }
          if (text === null) {
            finished = true;
            break;
          }
          await own(capture.write(text));
          read = own(reader.read());
        }
      } catch {
      }
      await own(capture.finish());
    } catch {
    } finally {
      resolveAdmission();
      if (!finished) reader?.cancel();
      lease?.release();
    }
  }
  function settleOrFlushDue(read, delay) {
    if (delay === Infinity) return read;
    return new NativePromise((resolve, reject) => {
      const timer = scheduleTimeout(() => resolve(FLUSH_DUE), max(0, delay));
      void settle(read, (value) => {
        cancelTimeout(timer);
        resolve(value);
      }, (error) => {
        cancelTimeout(timer);
        reject(error);
      });
    });
  }
  var StreamBytes = class {
    static {
      setPrototypeOf(this.prototype, null);
    }
    constructor(stream) {
      this.chunks = [];
      this.offset = 0;
      this.taken = null;
      this.wake = null;
      this.draining = false;
      this.ended = false;
      this.failed = false;
      this.controller = new NativeAbortController();
      const settled = (failed) => () => {
        this.ended = true;
        this.failed ||= failed;
        this.notify();
      };
      const sink = {
        __proto__: null,
        write: (chunk) => {
          append(this.chunks, chunk);
          this.notify();
          if (this.draining) return void 0;
          return own(new NativePromise((resolve) => {
            this.taken = resolve;
          }));
        },
        close: settled(false),
        abort: settled(true)
      };
      void settle(apply(pipeTo, stream, [new NativeWritableStream(sink), {
        __proto__: null,
        signal: apply(abortSignalOf, this.controller, [])
      }]), settled(false), settled(true));
    }
    notify() {
      const wake = this.wake;
      this.wake = null;
      wake?.();
    }
    // Resolves once bytes can be taken or the stream has ended; rejects if it
    // failed. A drained stream ends as a closed one.
    async ready() {
      while (this.chunks.length === 0 && !this.ended) {
        await own(new NativePromise((resolve) => {
          this.wake = resolve;
        }));
      }
      if (this.chunks.length === 0 && this.failed && !this.draining) {
        throw new NativeTypeError("The stream failed");
      }
    }
    // Takes up to maxBytes of the oldest chunk, or null at the end.
    take(maxBytes) {
      if (this.chunks.length === 0) return null;
      const chunk = this.chunks[0];
      const length = min(maxBytes, apply(typedArrayByteLength, chunk, []) - this.offset);
      const bytes = new NativeUint8Array(
        apply(typedArrayBuffer, chunk, []),
        apply(typedArrayByteOffset, chunk, []) + this.offset,
        length
      );
      this.offset += length;
      if (this.offset === apply(typedArrayByteLength, chunk, [])) {
        removeAt(this.chunks, 0);
        this.offset = 0;
        if (this.chunks.length === 0) this.release();
      }
      return bytes;
    }
    release() {
      const taken = this.taken;
      this.taken = null;
      taken?.();
    }
    // Takes every chunk the stream holds now, then ends it. A tee branch holds
    // every chunk its sibling received, and the pipe hands over held chunks
    // without a task boundary, so the pipe is aborted after one task: chunks
    // that need the network by then are not waited for.
    drain() {
      if (this.draining || this.ended) return;
      this.draining = true;
      this.release();
      scheduleTimeout(() => apply(abortController, this.controller, []), 0);
    }
    // Ends the pipe, canceling the stream. A tee's cancellation can wait for
    // the other consumer, and is not awaited: cleanup must not hold the capture
    // hostage to the page reading its branch.
    cancel() {
      this.chunks.length = 0;
      this.release();
      apply(abortController, this.controller, []);
    }
  };
  var StreamTextReader = class {
    static {
      setPrototypeOf(this.prototype, null);
    }
    constructor(body, encoding = "utf-8") {
      this.bytes = new StreamBytes(body);
      this.decoder = new NativeTextDecoder(encoding);
      this.ended = false;
    }
    // Resolves with the next decoded text, or null at the end of the body.
    async read() {
      if (this.ended) return null;
      await own(this.bytes.ready());
      const bytes = this.bytes.take(READ_CHUNK_BYTES);
      if (bytes === null) {
        this.ended = true;
        return apply(textDecode, this.decoder, []);
      }
      return apply(textDecode, this.decoder, [bytes, { __proto__: null, stream: true }]);
    }
    cancel() {
      this.bytes.cancel();
    }
    drain() {
      this.bytes.drain();
    }
  };
  var TextCapture = class {
    static {
      setPrototypeOf(this.prototype, null);
    }
    constructor(lease, send) {
      this.lease = lease;
      this.send = send;
      this.text = "";
      this.bytes = 0;
      this.sentChars = 0;
      this.pendingSince = null;
      this.scanned = true;
    }
    async write(chunk) {
      if (chunk.length === 0) return;
      while (chunk.length > 0) {
        this.lease.fit(this.retainedBytes());
        const maxChars = min(
          MAX_CAPTURE_CHARS,
          this.lease.capacity - READ_CHUNK_BYTES >> 1
        );
        const taken = fitWindow(chunk, maxChars - this.text.length, MAX_SCAN_BYTES - this.bytes);
        this.text += apply(stringSlice, chunk, [0, taken.chars]);
        this.bytes += taken.bytes;
        chunk = apply(stringSlice, chunk, [taken.chars]);
        if (chunk.length > 0) await own(this.flush());
      }
      if (this.text.length > this.sentChars) this.pendingSince ??= now();
    }
    // Sends the text not yet sent and keeps the overlap for the next window.
    async flush() {
      this.pendingSince = null;
      if (this.text.length === this.sentChars) return;
      const text = this.text;
      this.lease.shrink(this.retainedBytes());
      if (await own(this.send(text)) !== true) this.scanned = false;
      const overlap = apply(textEncode, utf8Encoder, [apply(stringSlice, text, [-SCAN_WINDOW_OVERLAP_CHARS])]);
      this.text = apply(textDecode, utf8Decoder, [overlap]);
      this.bytes = apply(typedArrayByteLength, overlap, []);
      this.sentChars = this.text.length;
      this.lease.shrink(this.retainedBytes());
    }
    // The source is exhausted: sends the rest, retaining only that text.
    async finish() {
      this.lease.shrink(this.text.length * 2, 0);
      await own(this.flush());
    }
    // Milliseconds until unsent text is due to be scanned, or Infinity.
    flushDelay() {
      return this.pendingSince === null ? Infinity : this.pendingSince + CAPTURE_FLUSH_MS - now();
    }
    retainedBytes() {
      return this.text.length * 2 + READ_CHUNK_BYTES;
    }
  };
  function stringifyJSON(root) {
    const open = [];
    let text = "";
    let value = root;
    while (true) {
      if (value === null) {
        text += "null";
      } else if (typeof value === "string") {
        text += quoteJSON(value);
      } else if (typeof value === "number") {
        text += isFiniteNumber(value) ? `${value}` : "null";
      } else if (typeof value === "boolean") {
        text += value ? "true" : "false";
      } else {
        const array = isArray(value);
        text += array ? "[" : "{";
        append(open, {
          __proto__: null,
          value,
          keys: array ? null : objectKeys(value),
          index: 0,
          written: false
        });
      }
      value = void 0;
      while (open.length > 0 && value === void 0) {
        const frame = open[open.length - 1];
        if (frame.keys === null && frame.index < frame.value.length) {
          const item = frame.value[frame.index];
          text += frame.index > 0 ? "," : "";
          value = isJSONValue(item) ? item : null;
          frame.index += 1;
        } else if (frame.keys !== null && frame.index < frame.keys.length) {
          const key = frame.keys[frame.index];
          const item = frame.value[key];
          if (isJSONValue(item)) {
            text += `${frame.written ? "," : ""}${quoteJSON(key)}:`;
            frame.written = true;
            value = item;
          }
          frame.index += 1;
        } else {
          text += frame.keys === null ? "]" : "}";
          open.length -= 1;
        }
      }
      if (value === void 0) return text;
    }
  }
  function isJSONValue(value) {
    const type = typeof value;
    return value === null || type === "string" || type === "number" || type === "boolean" || type === "object";
  }
  function quoteJSON(value) {
    let text = '"';
    let runStart = 0;
    for (let index = 0; index < value.length; index += 1) {
      const code = apply(stringCharCodeAt, value, [index]);
      const character = value[index];
      if (code >= 55296 && code <= 56319) {
        const next = apply(stringCharCodeAt, value, [index + 1]);
        if (next >= 56320 && next <= 57343) {
          index += 1;
          continue;
        }
      }
      const escaped = character === '"' ? '\\"' : character === "\\" ? "\\\\" : character === "\b" ? "\\b" : character === "\f" ? "\\f" : character === "\n" ? "\\n" : character === "\r" ? "\\r" : character === "	" ? "\\t" : code < 32 || code >= 55296 && code <= 57343 ? `\\u${apply(stringPadStart, apply(numberToString, code, [16]), [4, "0"])}` : null;
      if (escaped === null) continue;
      text += apply(stringSlice, value, [runStart, index]) + escaped;
      runStart = index + 1;
    }
    return `${text}${apply(stringSlice, value, [runStart])}"`;
  }
  function sendResponseWindow(url, resourceType, text) {
    return sendToBridge({ type: PAGE_HOOK_RESPONSE, url, resourceType, text });
  }
  function sendToBridge(message) {
    return queueCapture(async () => {
      if (captureStopped) return;
      const messageId = nextMessageId++;
      const acknowledged = own(new NativePromise((resolve) => {
        pendingAcks[messageId] = resolve;
      }));
      apply(postPortMessage, bridgePort, [{ ...message, messageId }]);
      return await acknowledged;
    });
  }
  function queueCapture(operation) {
    return own(new NativePromise((resolve, reject) => {
      append(captureQueue, { __proto__: null, operation, resolve, reject });
      drainCaptureQueue();
    }));
  }
  function drainCaptureQueue() {
    while (activeCaptures < MAX_ACTIVE_CAPTURES && captureQueue.length > 0) {
      const index = preferNewestCapture && captureQueue.length > 1 ? captureQueue.length - 1 : 0;
      preferNewestCapture = !preferNewestCapture;
      const task = removeAt(captureQueue, index);
      activeCaptures += 1;
      void runCapture(task);
    }
  }
  async function runCapture(task) {
    try {
      task.resolve(await own(task.operation()));
    } catch (error) {
      task.reject(error);
    } finally {
      activeCaptures -= 1;
      drainCaptureQueue();
    }
  }
  var CaptureMemoryBudget = class {
    static {
      setPrototypeOf(this.prototype, null);
    }
    constructor(limit) {
      this.limit = limit;
      this.used = 0;
      this.waiters = [];
      this.preferNewest = true;
    }
    async lease(size) {
      const reserved = this.reserve(size);
      if (reserved) await reserved;
      return new CaptureMemoryLease(this, size);
    }
    reserve(size) {
      if (this.used + size <= this.limit) {
        this.used += size;
        return void 0;
      }
      return own(new NativePromise((resolve) => {
        append(this.waiters, { __proto__: null, size, resolve });
      }));
    }
    // Takes up to `size` without waiting, only while no admission waits.
    take(size) {
      if (this.waiters.length > 0) return 0;
      const taken = max(0, min(size, this.limit - this.used));
      this.used += taken;
      return taken;
    }
    release(size) {
      this.used -= size;
      while (this.waiters.length > 0) {
        const available = this.limit - this.used;
        let index = -1;
        const count = this.waiters.length;
        for (let step = 0; step < count && index < 0; step += 1) {
          const candidate = this.preferNewest ? count - 1 - step : step;
          if (this.waiters[candidate].size <= available) index = candidate;
        }
        if (index < 0) return;
        this.preferNewest = !this.preferNewest;
        const waiter = removeAt(this.waiters, index);
        this.used += waiter.size;
        waiter.resolve();
      }
    }
  };
  var CaptureMemoryLease = class {
    static {
      setPrototypeOf(this.prototype, null);
    }
    constructor(budget, capacity) {
      this.budget = budget;
      this.capacity = capacity;
    }
    // Returns what the capture does not retain while an admission waits, and
    // otherwise grows toward a full window.
    fit(retained) {
      if (this.budget.waiters.length > 0) {
        this.shrink(retained);
      } else {
        this.capacity += this.budget.take(CAPTURE_MEMORY_RESERVATION - this.capacity);
      }
    }
    // Keeps at least `minimum`, so a capture that still reads can progress.
    shrink(retained, minimum = CAPTURE_MEMORY_MINIMUM) {
      const capacity = max(minimum, retained);
      if (capacity >= this.capacity) return;
      this.budget.release(this.capacity - capacity);
      this.capacity = capacity;
    }
    release() {
      this.budget.release(this.capacity);
      this.capacity = 0;
    }
  };
  var captureMemory = new CaptureMemoryBudget(CAPTURE_MEMORY_LIMIT);
  {
    const channel = new MessageChannel();
    bridgePort = channel.port1;
    apply(addListener, bridgePort, ["message", handleBridgeMessage]);
    apply(addListener, bridgePort, ["close", stopCapturing]);
    apply(startPort, bridgePort, []);
    apply(dispatchEvent, window, [new NativeMessageEvent(PAGE_HOOK_READY, {
      __proto__: null,
      data: handshakeId,
      ports: [channel.port2]
    })]);
  }
  var shadowRootEvent = shadowRootEventType(handshakeId);
  register(document, (host) => {
    apply(dispatchEvent, host, [new NativeEvent(shadowRootEvent)]);
  }, SHADOW_ROOT_KEY);
  var cluster = clusterFacade();
  if (cluster) {
    cluster.adopt(window);
  } else {
    const guarded = (operation) => function() {
      try {
        return apply(operation, void 0, arguments);
      } catch {
        return void 0;
      }
    };
    pipelineFacade = freeze({
      __proto__: null,
      adopt: guarded(adoptWindow),
      adoptFrames: guarded(adoptFrames),
      adoptFrame: guarded(adoptFrame),
      adoptShadowFrames: guarded(adoptShadowFrames),
      popupOpened: guarded(popupOpened),
      fetched,
      xhrCreated: guarded(xhrCreated),
      clipboardText: guarded(reportClipboardText),
      clipboardItems: guarded((items, realm) => {
        void reportClipboardItems(items, realm);
      }),
      shadowAttached: guarded((host, root) => {
        popupShadowAttached(host, root);
        registered(apply(nodeOwnerDocument, host, []), SHADOW_ROOT_KEY)?.(host);
      }),
      bodyCaptured: guarded(bodyCaptured),
      bodyRead: guarded(bodyRead),
      objectURLCreated: guarded(objectURLCreated),
      objectURLRevoked: guarded(objectURLRevoked),
      blobScriptLoaded: guarded(blobScriptLoaded),
      scriptRegistered: guarded(reportScriptRegistered),
      messageRead: guarded(messageRead),
      scriptCompiled: guarded(scriptCompiled),
      styleAdded: guarded(styleAdded)
    });
    adoptWindow(window);
  }
  function handleBridgeMessage(event) {
    if (!event.isTrusted) return;
    const data = apply(messageEventData, event, []);
    if (data?.type === PAGE_HOOK_STOP) {
      stopCapturing();
      return;
    }
    if (data?.type === PAGE_HOOK_BLOB_SCRIPT) {
      windowFacade(window)?.blobScriptLoaded(data.url, data.encoding);
      return;
    }
    const resolve = data?.type === PAGE_HOOK_ACK ? pendingAcks[data.messageId] : void 0;
    if (typeof resolve !== "function") return;
    delete pendingAcks[data.messageId];
    resolve(data.scanned === true);
  }
  function stopCapturing() {
    if (captureStopped) return;
    captureStopped = true;
    apply(closePort, bridgePort, []);
    for (const messageId in pendingAcks) {
      pendingAcks[messageId]();
      delete pendingAcks[messageId];
    }
  }
  function isTextResponse(url, contentType) {
    return apply(regExpExec, TEXT_MEDIA_TYPE, [contentType || ""]) !== null || apply(regExpExec, TEXT_URL_EXTENSION, [url]) !== null;
  }
})();
