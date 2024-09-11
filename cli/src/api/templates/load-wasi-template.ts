export const createWasiBrowserBinding = (
  wasiFilename: string,
  wasiRegisterFunctions: string[],
  initialMemory = 4000,
  maximumMemory = 65536,
  fs = false,
) => {
  const fsImport = fs ? `import { memfs } from '@napi-rs/wasm-runtime/fs'` : ''
  const wasiCreation = fs
    ? `
export const { fs: __fs, vol: __volume } = memfs()

const __wasi = new __WASI({
  version: 'preview1',
  fs: __fs,
  preopens: {
    '/': '/',
  }
})`
    : `
const __wasi = new __WASI({
  version: 'preview1',
})`

  const workerFsHandler = fs
    ? `    worker.addEventListener('message', __wasmCreateOnMessageForFsProxy(__fs))\n`
    : ''

  return `import {
  instantiateNapiModuleSync as __emnapiInstantiateNapiModuleSync,
  getDefaultContext as __emnapiGetDefaultContext,
  WASI as __WASI,
  createOnMessage as __wasmCreateOnMessageForFsProxy,
} from '@napi-rs/wasm-runtime'
${fsImport}
import __wasmUrl from './${wasiFilename}.wasm?url'
${wasiCreation}

const __emnapiContext = __emnapiGetDefaultContext()

const __sharedMemory = new WebAssembly.Memory({
  initial: ${initialMemory},
  maximum: ${maximumMemory},
  shared: true,
})

const __wasmFile = await fetch(__wasmUrl).then((res) => res.arrayBuffer())

const {
  instance: __napiInstance,
  module: __wasiModule,
  napiModule: __napiModule,
} = __emnapiInstantiateNapiModuleSync(__wasmFile, {
  context: __emnapiContext,
  asyncWorkPoolSize: 4,
  wasi: __wasi,
  onCreateWorker() {
    const worker = new Worker(new URL('./wasi-worker-browser.mjs', import.meta.url), {
      type: 'module',
    })
${workerFsHandler}
    return worker
  },
  overwriteImports(importObject) {
    importObject.env = {
      ...importObject.env,
      ...importObject.napi,
      ...importObject.emnapi,
      memory: __sharedMemory,
    }
    return importObject
  },
  beforeInit({ instance }) {
    __napi_rs_initialize_modules(instance)
  },
})

function __napi_rs_initialize_modules(__napiInstance) {
${wasiRegisterFunctions
  .map((name) => `  __napiInstance.exports['${name}']?.()`)
  .join('\n')}
}
`
}

export const createWasiBinding = (
  wasmFileName: string,
  packageName: string,
  wasiRegisterFunctions: string[],
  initialMemory = 4000,
  maximumMemory = 65536,
) => `/* eslint-disable */
/* prettier-ignore */

/* auto-generated by NAPI-RS */

const __nodeFs = require('node:fs')
const __nodePath = require('node:path')
const { WASI: __nodeWASI } = require('node:wasi')
const { Worker } = require('node:worker_threads')

const {
  instantiateNapiModuleSync: __emnapiInstantiateNapiModuleSync,
  getDefaultContext: __emnapiGetDefaultContext,
  createOnMessage: __wasmCreateOnMessageForFsProxy,
} = require('@napi-rs/wasm-runtime')

const __rootDir = __nodePath.parse(process.cwd()).root

const __wasi = new __nodeWASI({
  version: 'preview1',
  env: process.env,
  preopens: {
    [__rootDir]: __rootDir,
  }
})

const __emnapiContext = __emnapiGetDefaultContext()

const __sharedMemory = new WebAssembly.Memory({
  initial: ${initialMemory},
  maximum: ${maximumMemory},
  shared: true,
})

let __wasmFilePath = __nodePath.join(__dirname, '${wasmFileName}.wasm')
const __wasmDebugFilePath = __nodePath.join(__dirname, '${wasmFileName}.debug.wasm')

if (__nodeFs.existsSync(__wasmDebugFilePath)) {
  __wasmFilePath = __wasmDebugFilePath
} else if (!__nodeFs.existsSync(__wasmFilePath)) {
  try {
    __wasmFilePath = __nodePath.resolve('${packageName}-wasm32-wasi')
  } catch {
    throw new Error('Cannot find ${wasmFileName}.wasm file, and ${packageName}-wasm32-wasi package is not installed.')
  }
}

const { instance: __napiInstance, module: __wasiModule, napiModule: __napiModule } = __emnapiInstantiateNapiModuleSync(__nodeFs.readFileSync(__wasmFilePath), {
  context: __emnapiContext,
  asyncWorkPoolSize: (function() {
    const threadsSizeFromEnv = Number(process.env.NAPI_RS_ASYNC_WORK_POOL_SIZE ?? process.env.UV_THREADPOOL_SIZE)
    // NaN > 0 is false
    if (threadsSizeFromEnv > 0) {
      return threadsSizeFromEnv
    } else {
      return 4
    }
  })(),
  wasi: __wasi,
  onCreateWorker() {
    const worker = new Worker(__nodePath.join(__dirname, 'wasi-worker.mjs'), {
      env: process.env,
      execArgv: ['--experimental-wasi-unstable-preview1'],
    })
    worker.onmessage = ({ data }) => {
      __wasmCreateOnMessageForFsProxy(__nodeFs)(data)
    }
    return worker
  },
  overwriteImports(importObject) {
    importObject.env = {
      ...importObject.env,
      ...importObject.napi,
      ...importObject.emnapi,
      memory: __sharedMemory,
    }
    return importObject
  },
  beforeInit({ instance }) {
    __napi_rs_initialize_modules(instance)
  }
})

function __napi_rs_initialize_modules(__napiInstance) {
${wasiRegisterFunctions
  .map((name) => `  __napiInstance.exports['${name}']?.()`)
  .join('\n')}
}
`
