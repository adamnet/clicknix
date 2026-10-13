// vendor/yara-x/pkg/snippets/yara-x-cf82eefb9e55f8c7/inline0.js
function hostFunction(memory, slots, length, params, results, call) {
  const paramIsI64 = Array.from(params, (type) => type === "I");
  const resultIsI64 = Array.from(results, (type) => type === "I");
  let f64 = new Float64Array(0);
  let i64 = new BigInt64Array(0);
  const refreshViews = () => {
    if (f64.length !== length) {
      f64 = new Float64Array(memory.buffer, slots, length);
      i64 = new BigInt64Array(memory.buffer, slots, length);
    }
  };
  const result = (i) => resultIsI64[i] ? i64[i] : f64[i];
  return (...args) => {
    refreshViews();
    for (let i = 0; i < paramIsI64.length; i++) {
      if (paramIsI64[i]) {
        i64[i] = args[i];
      } else {
        f64[i] = args[i];
      }
    }
    if (!call()) {
      return void 0;
    }
    refreshViews();
    switch (resultIsI64.length) {
      case 0:
        return void 0;
      case 1:
        return result(0);
      default:
        return resultIsI64.map((_, i) => result(i));
    }
  };
}

// vendor/yara-x/pkg/yara_x_js.js
var Compiler = class {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    CompilerFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_compiler_free(ptr, 0);
  }
  /**
   * @param {string} source
   */
  addSource(source) {
    const ptr0 = passStringToWasm0(source, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.compiler_addSource(this.__wbg_ptr, ptr0, len0);
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @returns {Rules}
   */
  build() {
    const ret = wasm.compiler_build(this.__wbg_ptr);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return Rules.__wrap(ret[0]);
  }
  /**
   * @param {string} identifier
   * @param {any} value
   */
  defineGlobal(identifier, value) {
    const ptr0 = passStringToWasm0(identifier, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.compiler_defineGlobal(this.__wbg_ptr, ptr0, len0, value);
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @returns {string[]}
   */
  get errors() {
    const ret = wasm.compiler_errors(this.__wbg_ptr);
    if (ret[3]) {
      throw takeFromExternrefTable0(ret[2]);
    }
    var v1 = getArrayJsValueFromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  constructor() {
    const ret = wasm.compiler_new();
    this.__wbg_ptr = ret;
    CompilerFinalization.register(this, this.__wbg_ptr, this);
    return this;
  }
  /**
   * @param {string} namespace
   */
  newNamespace(namespace) {
    const ptr0 = passStringToWasm0(namespace, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.compiler_newNamespace(this.__wbg_ptr, ptr0, len0);
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @returns {string[]}
   */
  get warnings() {
    const ret = wasm.compiler_warnings(this.__wbg_ptr);
    if (ret[3]) {
      throw takeFromExternrefTable0(ret[2]);
    }
    var v1 = getArrayJsValueFromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
};
if (Symbol.dispose) Compiler.prototype[Symbol.dispose] = Compiler.prototype.free;
var Rules = class _Rules {
  static __wrap(ptr) {
    const obj = Object.create(_Rules.prototype);
    obj.__wbg_ptr = ptr;
    RulesFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    RulesFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_rules_free(ptr, 0);
  }
  /**
   * @param {Uint8Array} payload
   * @returns {any}
   */
  scan(payload) {
    const ptr0 = passArray8ToWasm0(payload, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.rules_scan(this.__wbg_ptr, ptr0, len0);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
  }
  /**
   * @returns {Scanner}
   */
  scanner() {
    const ret = wasm.rules_scanner(this.__wbg_ptr);
    return Scanner.__wrap(ret);
  }
  /**
   * @returns {string[]}
   */
  get warnings() {
    const ret = wasm.rules_warnings(this.__wbg_ptr);
    var v1 = getArrayJsValueFromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
};
if (Symbol.dispose) Rules.prototype[Symbol.dispose] = Rules.prototype.free;
var Scanner = class _Scanner {
  static __wrap(ptr) {
    const obj = Object.create(_Scanner.prototype);
    obj.__wbg_ptr = ptr;
    ScannerFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    ScannerFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_scanner_free(ptr, 0);
  }
  /**
   * @param {Rules} rules
   */
  constructor(rules) {
    _assertClass(rules, Rules);
    const ret = wasm.scanner_new(rules.__wbg_ptr);
    this.__wbg_ptr = ret;
    ScannerFinalization.register(this, this.__wbg_ptr, this);
    return this;
  }
  /**
   * @param {Uint8Array} payload
   * @returns {any}
   */
  scan(payload) {
    const ptr0 = passArray8ToWasm0(payload, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.scanner_scan(this.__wbg_ptr, ptr0, len0);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
  }
  /**
   * @param {string} identifier
   * @param {any} value
   */
  setGlobal(identifier, value) {
    const ptr0 = passStringToWasm0(identifier, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.scanner_setGlobal(this.__wbg_ptr, ptr0, len0, value);
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @param {number} n
   */
  setMaxMatchesPerPattern(n) {
    wasm.scanner_setMaxMatchesPerPattern(this.__wbg_ptr, n);
  }
  /**
   * @param {number} timeout_ms
   */
  setTimeoutMs(timeout_ms) {
    wasm.scanner_setTimeoutMs(this.__wbg_ptr, timeout_ms);
  }
};
if (Symbol.dispose) Scanner.prototype[Symbol.dispose] = Scanner.prototype.free;
function __wbg_get_imports() {
  const import0 = {
    __proto__: null,
    __wbg_Error_fdd633d4bb5dd76a: function(arg0, arg1) {
      const ret = Error(getStringFromWasm0(arg0, arg1));
      return ret;
    },
    __wbg_String_8564e559799eccda: function(arg0, arg1) {
      const ret = String(arg1);
      const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      const len1 = WASM_VECTOR_LEN;
      getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
      getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    },
    __wbg___wbindgen_bigint_get_as_i64_d9e915702856f831: function(arg0, arg1) {
      const v = arg1;
      const ret = typeof v === "bigint" ? v : void 0;
      getDataViewMemory0().setBigInt64(arg0 + 8 * 1, isLikeNone(ret) ? BigInt(0) : ret, true);
      getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true);
    },
    __wbg___wbindgen_boolean_get_edaed31a367ce1bd: function(arg0) {
      const v = arg0;
      const ret = typeof v === "boolean" ? v : void 0;
      return isLikeNone(ret) ? 16777215 : ret ? 1 : 0;
    },
    __wbg___wbindgen_debug_string_8a447059637473e2: function(arg0, arg1) {
      const ret = debugString(arg1);
      const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      const len1 = WASM_VECTOR_LEN;
      getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
      getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    },
    __wbg___wbindgen_in_4990f46af709e33c: function(arg0, arg1) {
      const ret = arg0 in arg1;
      return ret;
    },
    __wbg___wbindgen_is_bigint_90b5ccfe67c78460: function(arg0) {
      const ret = typeof arg0 === "bigint";
      return ret;
    },
    __wbg___wbindgen_is_function_acc5528be2b923f2: function(arg0) {
      const ret = typeof arg0 === "function";
      return ret;
    },
    __wbg___wbindgen_is_object_0beba4a1980d3eea: function(arg0) {
      const val = arg0;
      const ret = typeof val === "object" && val !== null;
      return ret;
    },
    __wbg___wbindgen_is_undefined_721f8decd50c87a3: function(arg0) {
      const ret = arg0 === void 0;
      return ret;
    },
    __wbg___wbindgen_jsval_eq_4e8c38722cb8ff51: function(arg0, arg1) {
      const ret = arg0 === arg1;
      return ret;
    },
    __wbg___wbindgen_jsval_loose_eq_4b9aba9e5b3c4582: function(arg0, arg1) {
      const ret = arg0 == arg1;
      return ret;
    },
    __wbg___wbindgen_memory_9751d9a3017e7c25: function() {
      const ret = wasm.memory;
      return ret;
    },
    __wbg___wbindgen_number_get_1cc01dd708740256: function(arg0, arg1) {
      const obj = arg1;
      const ret = typeof obj === "number" ? obj : void 0;
      getDataViewMemory0().setFloat64(arg0 + 8 * 1, isLikeNone(ret) ? 0 : ret, true);
      getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true);
    },
    __wbg___wbindgen_string_get_71bb4348194e31f0: function(arg0, arg1) {
      const obj = arg1;
      const ret = typeof obj === "string" ? obj : void 0;
      var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      var len1 = WASM_VECTOR_LEN;
      getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
      getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    },
    __wbg___wbindgen_throw_ea4887a5f8f9a9db: function(arg0, arg1) {
      throw new Error(getStringFromWasm0(arg0, arg1));
    },
    __wbg__wbg_cb_unref_33c39e13d73b25f6: function(arg0) {
      arg0._wbg_cb_unref();
    },
    __wbg_buffer_49b4f592d8036785: function(arg0) {
      const ret = arg0.buffer;
      return ret;
    },
    __wbg_call_5575218572ead796: function() {
      return handleError(function(arg0, arg1, arg2) {
        const ret = arg0.call(arg1, arg2);
        return ret;
      }, arguments);
    },
    __wbg_call_8e98ed2f3c86c4b5: function() {
      return handleError(function(arg0, arg1) {
        const ret = arg0.call(arg1);
        return ret;
      }, arguments);
    },
    __wbg_done_b62d4a7d2286852a: function(arg0) {
      const ret = arg0.done;
      return ret;
    },
    __wbg_entries_c261c3fa1f281256: function(arg0) {
      const ret = Object.entries(arg0);
      return ret;
    },
    __wbg_exports_bf6d3d7e79dd313b: function(arg0) {
      const ret = arg0.exports;
      return ret;
    },
    __wbg_get_197a3fe98f169e38: function(arg0, arg1) {
      const ret = arg0[arg1 >>> 0];
      return ret;
    },
    __wbg_get_9a29be2cb383ed9a: function() {
      return handleError(function(arg0, arg1) {
        const ret = Reflect.get(arg0, arg1);
        return ret;
      }, arguments);
    },
    __wbg_get_dddb90ff5d27a080: function() {
      return handleError(function(arg0, arg1) {
        const ret = Reflect.get(arg0, arg1);
        return ret;
      }, arguments);
    },
    __wbg_get_unchecked_54a4374c38e08460: function(arg0, arg1) {
      const ret = arg0[arg1 >>> 0];
      return ret;
    },
    __wbg_hostFunction_f3e98c8d27dd9b5d: function(arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7) {
      const ret = hostFunction(arg0, arg1 >>> 0, arg2 >>> 0, getStringFromWasm0(arg3, arg4), getStringFromWasm0(arg5, arg6), arg7);
      return ret;
    },
    __wbg_imports_056c9652ef5c7e46: function(arg0) {
      const ret = WebAssembly.Module.imports(arg0);
      return ret;
    },
    __wbg_instanceof_ArrayBuffer_2a7bb09fee70c2da: function(arg0) {
      let result;
      try {
        result = arg0 instanceof ArrayBuffer;
      } catch (_) {
        result = false;
      }
      const ret = result;
      return ret;
    },
    __wbg_instanceof_Map_afa18d5840c04c15: function(arg0) {
      let result;
      try {
        result = arg0 instanceof Map;
      } catch (_) {
        result = false;
      }
      const ret = result;
      return ret;
    },
    __wbg_instanceof_Uint8Array_f080092dc70f5d58: function(arg0) {
      let result;
      try {
        result = arg0 instanceof Uint8Array;
      } catch (_) {
        result = false;
      }
      const ret = result;
      return ret;
    },
    __wbg_isArray_145a34fd0a38d37b: function(arg0) {
      const ret = Array.isArray(arg0);
      return ret;
    },
    __wbg_isSafeInteger_a3389a198582f5f6: function(arg0) {
      const ret = Number.isSafeInteger(arg0);
      return ret;
    },
    __wbg_iterator_cc47ba25a2be735a: function() {
      const ret = Symbol.iterator;
      return ret;
    },
    __wbg_length_589238bdcf171f0e: function(arg0) {
      const ret = arg0.length;
      return ret;
    },
    __wbg_length_c6054974c0a6cdb9: function(arg0) {
      const ret = arg0.length;
      return ret;
    },
    __wbg_new_2e117a478906f062: function() {
      const ret = new Object();
      return ret;
    },
    __wbg_new_36e147a8ced3c6e0: function() {
      const ret = new Array();
      return ret;
    },
    __wbg_new_669dbd912b3ac42f: function() {
      return handleError(function(arg0, arg1) {
        const ret = new WebAssembly.Global(arg0, arg1);
        return ret;
      }, arguments);
    },
    __wbg_new_6af024326b90efb7: function() {
      return handleError(function(arg0) {
        const ret = new WebAssembly.Module(arg0);
        return ret;
      }, arguments);
    },
    __wbg_new_81880fb5002cb255: function(arg0) {
      const ret = new Uint8Array(arg0);
      return ret;
    },
    __wbg_new_9317ec2f3d86d4ea: function() {
      return handleError(function(arg0) {
        const ret = new WebAssembly.Memory(arg0);
        return ret;
      }, arguments);
    },
    __wbg_new_e66a4b7758dd2e5c: function(arg0, arg1) {
      const ret = new Error(getStringFromWasm0(arg0, arg1));
      return ret;
    },
    __wbg_new_f749bf2c00f4e889: function() {
      return handleError(function(arg0, arg1) {
        const ret = new WebAssembly.Instance(arg0, arg1);
        return ret;
      }, arguments);
    },
    __wbg_new_from_slice_543b875b27789a8f: function(arg0, arg1) {
      const ret = new Uint8Array(getArrayU8FromWasm0(arg0, arg1));
      return ret;
    },
    __wbg_next_0c4066e251d2eff9: function() {
      return handleError(function(arg0) {
        const ret = arg0.next();
        return ret;
      }, arguments);
    },
    __wbg_next_402fa10b59ab20c3: function(arg0) {
      const ret = arg0.next;
      return ret;
    },
    __wbg_now_d2e0afbad4edbe82: function() {
      const ret = Date.now();
      return ret;
    },
    __wbg_prototypesetcall_d721637c7ca66eb8: function(arg0, arg1, arg2) {
      Uint8Array.prototype.set.call(getArrayU8FromWasm0(arg0, arg1), arg2);
    },
    __wbg_set_0bf1fca872bc6d18: function(arg0, arg1, arg2) {
      arg0.set(getArrayU8FromWasm0(arg1, arg2));
    },
    __wbg_set_4564f7dc44fcb0c9: function() {
      return handleError(function(arg0, arg1, arg2) {
        const ret = Reflect.set(arg0, arg1, arg2);
        return ret;
      }, arguments);
    },
    __wbg_set_6be42768c690e380: function(arg0, arg1, arg2) {
      arg0[arg1] = arg2;
    },
    __wbg_set_dc601f4a69da0bc2: function(arg0, arg1, arg2) {
      arg0[arg1 >>> 0] = arg2;
    },
    __wbg_set_value_2514eda76d3704a3: function(arg0, arg1) {
      arg0.value = arg1;
    },
    __wbg_static_accessor_GLOBAL_THIS_2fee5048bcca5938: function() {
      const ret = typeof globalThis === "undefined" ? null : globalThis;
      return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    },
    __wbg_static_accessor_GLOBAL_ce44e66a4935da8c: function() {
      const ret = typeof global === "undefined" ? null : global;
      return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    },
    __wbg_static_accessor_SELF_44f6e0cb5e67cdad: function() {
      const ret = typeof self === "undefined" ? null : self;
      return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    },
    __wbg_static_accessor_WINDOW_168f178805d978fe: function() {
      const ret = typeof window === "undefined" ? null : window;
      return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    },
    __wbg_toString_47c26f096dbd9c68: function() {
      return handleError(function(arg0, arg1) {
        const ret = arg0.toString(arg1);
        return ret;
      }, arguments);
    },
    __wbg_value_49f783bb59765962: function(arg0) {
      const ret = arg0.value;
      return ret;
    },
    __wbg_value_f9ab611b95e6a4df: function(arg0) {
      const ret = arg0.value;
      return ret;
    },
    __wbindgen_cast_0000000000000001: function(arg0, arg1) {
      const ret = makeMutClosure(arg0, arg1, wasm_bindgen_c97e696c9a1b9dd6___convert__closures_____invoke___bool__true_);
      return ret;
    },
    __wbindgen_cast_0000000000000002: function(arg0) {
      const ret = arg0;
      return ret;
    },
    __wbindgen_cast_0000000000000003: function(arg0) {
      const ret = arg0;
      return ret;
    },
    __wbindgen_cast_0000000000000004: function(arg0, arg1) {
      const ret = getStringFromWasm0(arg0, arg1);
      return ret;
    },
    __wbindgen_cast_0000000000000005: function(arg0) {
      const ret = BigInt.asUintN(64, arg0);
      return ret;
    },
    __wbindgen_init_externref_table: function() {
      const table = wasm.__wbindgen_externrefs;
      const offset = table.grow(4);
      table.set(0, void 0);
      table.set(offset + 0, void 0);
      table.set(offset + 1, null);
      table.set(offset + 2, true);
      table.set(offset + 3, false);
    }
  };
  return {
    __proto__: null,
    "./yara_x_js_bg.js": import0
  };
}
function wasm_bindgen_c97e696c9a1b9dd6___convert__closures_____invoke___bool__true_(arg0, arg1) {
  const ret = wasm.wasm_bindgen_c97e696c9a1b9dd6___convert__closures_____invoke___bool__true_(arg0, arg1);
  return ret !== 0;
}
var CompilerFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm.__wbg_compiler_free(ptr, 1));
var RulesFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm.__wbg_rules_free(ptr, 1));
var ScannerFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm.__wbg_scanner_free(ptr, 1));
function addToExternrefTable0(obj) {
  const idx = wasm.__externref_table_alloc();
  wasm.__wbindgen_externrefs.set(idx, obj);
  return idx;
}
function _assertClass(instance, klass) {
  if (!(instance instanceof klass)) {
    throw new Error(`expected instance of ${klass.name}`);
  }
}
var CLOSURE_DTORS = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((state) => wasm.__wbindgen_destroy_closure(state.a, state.b));
function debugString(val) {
  const type = typeof val;
  if (type == "number" || type == "boolean" || val == null) {
    return `${val}`;
  }
  if (type == "string") {
    return `"${val}"`;
  }
  if (type == "symbol") {
    const description = val.description;
    if (description == null) {
      return "Symbol";
    } else {
      return `Symbol(${description})`;
    }
  }
  if (type == "function") {
    const name = val.name;
    if (typeof name == "string" && name.length > 0) {
      return `Function(${name})`;
    } else {
      return "Function";
    }
  }
  if (Array.isArray(val)) {
    const length = val.length;
    let debug = "[";
    if (length > 0) {
      debug += debugString(val[0]);
    }
    for (let i = 1; i < length; i++) {
      debug += ", " + debugString(val[i]);
    }
    debug += "]";
    return debug;
  }
  const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
  let className;
  if (builtInMatches && builtInMatches.length > 1) {
    className = builtInMatches[1];
  } else {
    return toString.call(val);
  }
  if (className == "Object") {
    try {
      return "Object(" + JSON.stringify(val) + ")";
    } catch (_) {
      return "Object";
    }
  }
  if (val instanceof Error) {
    return `${val.name}: ${val.message}
${val.stack}`;
  }
  return className;
}
function getArrayJsValueFromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  const mem = getDataViewMemory0();
  const result = [];
  for (let i = ptr; i < ptr + 4 * len; i += 4) {
    result.push(wasm.__wbindgen_externrefs.get(mem.getUint32(i, true)));
  }
  wasm.__externref_drop_slice(ptr, len);
  return result;
}
function getArrayU8FromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}
var cachedDataViewMemory0 = null;
function getDataViewMemory0() {
  if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || cachedDataViewMemory0.buffer.detached === void 0 && cachedDataViewMemory0.buffer !== wasm.memory.buffer) {
    cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
  }
  return cachedDataViewMemory0;
}
function getStringFromWasm0(ptr, len) {
  return decodeText(ptr >>> 0, len);
}
var cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
  if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
    cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
  }
  return cachedUint8ArrayMemory0;
}
function handleError(f, args) {
  try {
    return f.apply(this, args);
  } catch (e) {
    const idx = addToExternrefTable0(e);
    wasm.__wbindgen_exn_store(idx);
  }
}
function isLikeNone(x) {
  return x === void 0 || x === null;
}
function makeMutClosure(arg0, arg1, f) {
  const state = { a: arg0, b: arg1, cnt: 1 };
  const real = (...args) => {
    state.cnt++;
    const a = state.a;
    state.a = 0;
    try {
      return f(a, state.b, ...args);
    } finally {
      state.a = a;
      real._wbg_cb_unref();
    }
  };
  real._wbg_cb_unref = () => {
    if (--state.cnt === 0) {
      wasm.__wbindgen_destroy_closure(state.a, state.b);
      state.a = 0;
      CLOSURE_DTORS.unregister(state);
    }
  };
  CLOSURE_DTORS.register(real, state, state);
  return real;
}
function passArray8ToWasm0(arg, malloc) {
  const ptr = malloc(arg.length * 1, 1) >>> 0;
  getUint8ArrayMemory0().set(arg, ptr / 1);
  WASM_VECTOR_LEN = arg.length;
  return ptr;
}
function passStringToWasm0(arg, malloc, realloc) {
  if (realloc === void 0) {
    const buf = cachedTextEncoder.encode(arg);
    const ptr2 = malloc(buf.length, 1) >>> 0;
    getUint8ArrayMemory0().subarray(ptr2, ptr2 + buf.length).set(buf);
    WASM_VECTOR_LEN = buf.length;
    return ptr2;
  }
  let len = arg.length;
  let ptr = malloc(len, 1) >>> 0;
  const mem = getUint8ArrayMemory0();
  let offset = 0;
  for (; offset < len; offset++) {
    const code = arg.charCodeAt(offset);
    if (code > 127) break;
    mem[ptr + offset] = code;
  }
  if (offset !== len) {
    if (offset !== 0) {
      arg = arg.slice(offset);
    }
    ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
    const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
    const ret = cachedTextEncoder.encodeInto(arg, view);
    offset += ret.written;
    ptr = realloc(ptr, len, offset, 1) >>> 0;
  }
  WASM_VECTOR_LEN = offset;
  return ptr;
}
function takeFromExternrefTable0(idx) {
  const value = wasm.__wbindgen_externrefs.get(idx);
  wasm.__externref_table_dealloc(idx);
  return value;
}
var cachedTextDecoder = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
var MAX_SAFARI_DECODE_BYTES = 2146435072;
var numBytesDecoded = 0;
function decodeText(ptr, len) {
  numBytesDecoded += len;
  if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
    cachedTextDecoder = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true });
    cachedTextDecoder.decode();
    numBytesDecoded = len;
  }
  return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}
var cachedTextEncoder = new TextEncoder();
if (!("encodeInto" in cachedTextEncoder)) {
  cachedTextEncoder.encodeInto = function(arg, view) {
    const buf = cachedTextEncoder.encode(arg);
    view.set(buf);
    return {
      read: arg.length,
      written: buf.length
    };
  };
}
var WASM_VECTOR_LEN = 0;
var wasmModule;
var wasmInstance;
var wasm;
function __wbg_finalize_init(instance, module) {
  wasmInstance = instance;
  wasm = instance.exports;
  wasmModule = module;
  cachedDataViewMemory0 = null;
  cachedUint8ArrayMemory0 = null;
  wasm.__wbindgen_start();
  return wasm;
}
async function __wbg_load(module, imports) {
  if (typeof Response === "function" && module instanceof Response) {
    if (typeof WebAssembly.instantiateStreaming === "function") {
      try {
        return await WebAssembly.instantiateStreaming(module, imports);
      } catch (e) {
        const validResponse = module.ok && expectedResponseType(module.type);
        if (validResponse && module.headers.get("Content-Type") !== "application/wasm") {
          console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);
        } else {
          throw e;
        }
      }
    }
    const bytes = await module.arrayBuffer();
    return await WebAssembly.instantiate(bytes, imports);
  } else {
    const instance = await WebAssembly.instantiate(module, imports);
    if (instance instanceof WebAssembly.Instance) {
      return { instance, module };
    } else {
      return instance;
    }
  }
  function expectedResponseType(type) {
    switch (type) {
      case "basic":
      case "cors":
      case "default":
        return true;
    }
    return false;
  }
}
async function __wbg_init(module_or_path) {
  if (wasm !== void 0) return wasm;
  if (module_or_path !== void 0) {
    if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
      ({ module_or_path } = module_or_path);
    } else {
      console.warn("using deprecated parameters for the initialization function; pass a single object instead");
    }
  }
  if (module_or_path === void 0) {
    module_or_path = new URL("yara_x_js_bg.wasm", import.meta.url);
  }
  const imports = __wbg_get_imports();
  if (typeof module_or_path === "string" || typeof Request === "function" && module_or_path instanceof Request || typeof URL === "function" && module_or_path instanceof URL) {
    module_or_path = fetch(module_or_path);
  }
  const { instance, module } = await __wbg_load(await module_or_path, imports);
  return __wbg_finalize_init(instance, module);
}

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

// src/config.js
var MAX_RULE_SOURCE_BYTES = 4 * 1024 * 1024;
var MAX_RULE_BUNDLE_BYTES = 8 * MAX_RULE_SOURCE_BYTES;
var MAX_SCAN_BYTES = 2 * 1024 * 1024;
var SCAN_WINDOW_OVERLAP_CHARS = 64 * 1024;

// src/rule-bundle.js
var RULE_BUNDLE_PROPERTIES = /* @__PURE__ */ new Set([
  "schema",
  "engine",
  "rulesVersion",
  "generatedAt",
  "sha256",
  "ruleCount",
  "rules"
]);
var RULE_BUNDLE_SCHEMA = "clicknix.rules.v1";
var RFC3339_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:[Zz]|([+-])(\d{2}):(\d{2}))$/;
async function validateRuleBundle(bundle, {
  expectedSchema = RULE_BUNDLE_SCHEMA,
  maxSourceBytes = MAX_RULE_SOURCE_BYTES
} = {}) {
  if (!bundle || typeof bundle !== "object" || Array.isArray(bundle)) {
    throw new Error("Rule bundle must be an object");
  }
  const unexpectedProperty = Object.keys(bundle).find((property) => !RULE_BUNDLE_PROPERTIES.has(property));
  if (unexpectedProperty) {
    throw new Error(`Rule bundle has an unexpected property: ${unexpectedProperty}`);
  }
  if (bundle.schema !== expectedSchema) {
    throw new Error("Unsupported rule bundle schema");
  }
  if (bundle.engine !== "yara-x-js-wasm") {
    throw new Error("Unsupported rule engine");
  }
  if (typeof bundle.rulesVersion !== "string" || bundle.rulesVersion.length === 0 || bundle.rulesVersion.length > 128) {
    throw new Error("Rule bundle has an invalid version");
  }
  if (typeof bundle.generatedAt !== "string" || !isRFC3339DateTime(bundle.generatedAt)) {
    throw new Error("Rule bundle has an invalid generation timestamp");
  }
  if (!Number.isInteger(bundle.ruleCount) || bundle.ruleCount < 1) {
    throw new Error("Rule bundle has an invalid rule count");
  }
  if (typeof bundle.rules !== "string" || bundle.rules.length === 0) {
    throw new Error("Rule bundle has no rule source");
  }
  const sourceBytes = new TextEncoder().encode(bundle.rules);
  if (sourceBytes.byteLength > maxSourceBytes) {
    throw new Error("Rule bundle exceeds the source-size limit");
  }
  if (!/^[a-f0-9]{64}$/.test(bundle.sha256)) {
    throw new Error("Rule bundle has an invalid SHA-256 digest");
  }
  const digest = await crypto.subtle.digest("SHA-256", sourceBytes);
  const actualSha256 = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  if (actualSha256 !== bundle.sha256) {
    throw new Error("Rule bundle digest mismatch");
  }
  return {
    schema: bundle.schema,
    engine: bundle.engine,
    rulesVersion: bundle.rulesVersion,
    generatedAt: bundle.generatedAt,
    sha256: bundle.sha256,
    ruleCount: bundle.ruleCount,
    rules: bundle.rules
  };
}
function isRFC3339DateTime(value) {
  const match = value.match(RFC3339_DATE_TIME);
  if (!match) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetSign = match[7];
  const offsetHour = match[8] === void 0 ? 0 : Number(match[8]);
  const offsetMinute = match[9] === void 0 ? 0 : Number(match[9]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysPerMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const daysInMonth = daysPerMonth[month - 1];
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth && hour <= 23 && minute <= 59 && offsetHour <= 23 && offsetMinute <= 59 && (second <= 59 || second === 60 && isValidLeapSecond({ year, month, day, hour, minute, offsetSign, offsetHour, offsetMinute }));
}
function isValidLeapSecond({
  year,
  month,
  day,
  hour,
  minute,
  offsetSign,
  offsetHour,
  offsetMinute
}) {
  const localTime = /* @__PURE__ */ new Date(0);
  localTime.setUTCFullYear(year, month - 1, day);
  localTime.setUTCHours(hour, minute, 59, 0);
  const offsetDirection = offsetSign === "-" ? -1 : 1;
  const offsetMilliseconds = offsetDirection * (offsetHour * 60 + offsetMinute) * 60 * 1e3;
  const utcTime = new Date(localTime.getTime() - offsetMilliseconds);
  const expectedDay = utcTime.getUTCMonth() === 5 ? 30 : utcTime.getUTCMonth() === 11 ? 31 : void 0;
  return utcTime.getUTCDate() === expectedDay && utcTime.getUTCHours() === 23 && utcTime.getUTCMinutes() === 59 && utcTime.getUTCSeconds() === 59;
}

// src/rules-loader-bundled.js
async function loadRuleBundle() {
  const bundleUrl = new URL("rules/bundle.json", self.location.href);
  const response = await fetch(bundleUrl, {
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error("Bundled rule bundle is unavailable");
  }
  const body = await readBoundedResponseText(response, {
    maxBytes: MAX_RULE_BUNDLE_BYTES,
    maxChars: MAX_RULE_BUNDLE_BYTES
  });
  if (body.truncated) {
    throw new Error("Bundled rule bundle exceeds the size limit");
  }
  return validateRuleBundle(JSON.parse(body.text));
}

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

// src/scanner-worker.js
var runtime;
var scannerState = "initializing";
var terminalFailure;
void initializeScanner();
self.addEventListener("message", (event) => {
  if (event.data?.type !== SCANNER_WORKER_MESSAGES.SCAN) {
    return;
  }
  const { requestId, payload, lengths } = event.data;
  if (scannerState !== "ready") {
    postScanFailure(requestId, terminalFailure || createScannerFailure({
      code: SCANNER_FAILURE_CODES.INITIALIZATION_FAILED,
      stage: "initialization",
      message: "YARA-X scanner initialization is still in progress",
      terminal: false
    }));
    return;
  }
  if (!(payload instanceof ArrayBuffer) || !packsPayload(lengths, payload.byteLength)) {
    postScanFailure(requestId, createScannerFailure({
      code: SCANNER_FAILURE_CODES.INVALID_REQUEST,
      stage: "request",
      message: "YARA-X scan payload is not an ArrayBuffer of the listed buffer lengths"
    }));
    return;
  }
  const results = [];
  let offset = 0;
  for (const length of lengths) {
    const result = scanBuffer(new Uint8Array(payload, offset, length));
    offset += length;
    if (result.failure?.terminal) {
      postScanFailure(requestId, result.failure);
      return;
    }
    results.push(result);
  }
  try {
    self.postMessage({
      type: SCANNER_WORKER_MESSAGES.SCAN_RESULT,
      requestId,
      result: { rulesVersion: runtime.bundle.rulesVersion, results }
    });
  } catch (error) {
    postScanFailure(requestId, createScannerFailure({
      code: SCANNER_FAILURE_CODES.RESULT_TRANSPORT_FAILED,
      stage: "result-transport",
      message: `ClickNix could not return the scan result: ${errorDetail(error)}`
    }));
  }
});
function packsPayload(lengths, byteLength) {
  return Array.isArray(lengths) && lengths.length > 0 && lengths.every((length) => Number.isInteger(length) && length >= 0) && lengths.reduce((total, length) => total + length, 0) === byteLength;
}
function scanBuffer(bytes) {
  let result;
  try {
    result = runtime.scanner.scan(bytes);
  } catch (error) {
    return {
      failure: createScannerFailure({
        code: SCANNER_FAILURE_CODES.YARA_SCAN_EXCEPTION,
        stage: "yara-scan",
        message: `YARA-X scanner.scan() threw; the buffer was not evaluated: ${errorDetail(error)}`,
        terminal: error instanceof WebAssembly.RuntimeError
      })
    };
  }
  if (result.valid === false) {
    const detail = (result.errors || []).join("; ") || "unknown scan error";
    return {
      failure: createScannerFailure({
        code: SCANNER_FAILURE_CODES.INVALID_SCAN_RESULT,
        stage: "yara-result",
        message: `YARA-X could not evaluate the buffer: ${detail}`
      })
    };
  }
  try {
    return {
      matches: result.matches.map(normalizeMatch),
      // Compile warnings are logged once at load; keep only scan-time warnings.
      warnings: [...result.warnings || []].filter((warning) => !runtime.compileWarnings.has(warning))
    };
  } catch (error) {
    return {
      failure: createScannerFailure({
        code: SCANNER_FAILURE_CODES.RESULT_PROCESSING_FAILED,
        stage: "result-processing",
        message: `ClickNix could not normalize the YARA-X result: ${errorDetail(error)}`
      })
    };
  }
}
async function initializeScanner() {
  try {
    runtime = await createRuntime();
    scannerState = "ready";
    self.postMessage({
      type: SCANNER_WORKER_MESSAGES.INITIALIZED,
      runtime: runtimeMetadata(runtime)
    });
  } catch (error) {
    scannerState = "failed";
    terminalFailure = createScannerFailure({
      code: SCANNER_FAILURE_CODES.INITIALIZATION_FAILED,
      stage: "initialization",
      message: errorDetail(error),
      terminal: true
    });
    self.postMessage({
      type: SCANNER_WORKER_MESSAGES.INITIALIZATION_FAILED,
      failure: terminalFailure
    });
  }
}
async function createRuntime() {
  try {
    await __wbg_init();
  } catch (error) {
    throw new Error(`WASM initialization failed: ${errorDetail(error)}`);
  }
  let bundle;
  try {
    bundle = await loadRuleBundle();
  } catch (error) {
    throw new Error(`Rule bundle initialization failed: ${errorDetail(error)}`);
  }
  let compiler;
  try {
    compiler = new Compiler();
  } catch (error) {
    throw new Error(`YARA-X compiler initialization failed: ${errorDetail(error)}`);
  }
  try {
    try {
      compiler.addSource(bundle.rules);
    } catch (error) {
      throw new Error(`YARA-X rule compilation threw: ${errorDetail(error)}`);
    }
    if (compiler.errors.length > 0) {
      throw new Error(`YARA-X rule compilation failed: ${compiler.errors.join("; ")}`);
    }
    let rules;
    try {
      rules = compiler.build();
    } catch (error) {
      throw new Error(`YARA-X rule build failed: ${errorDetail(error)}`);
    }
    const compileWarnings = new Set(rules.warnings || []);
    return { bundle, scanner: rules.scanner(), compileWarnings };
  } finally {
    compiler.free();
  }
}
function normalizeMatch(match) {
  return {
    rule: match.identifier,
    namespace: match.namespace
  };
}
function runtimeMetadata(activeRuntime) {
  return {
    rulesVersion: activeRuntime.bundle.rulesVersion,
    ruleCount: activeRuntime.bundle.ruleCount,
    sha256: activeRuntime.bundle.sha256
  };
}
function postScanFailure(requestId, failure) {
  self.postMessage({
    type: SCANNER_WORKER_MESSAGES.SCAN_FAILED,
    requestId,
    failure
  });
}
function errorDetail(error) {
  return error instanceof Error ? error.message : String(error);
}
