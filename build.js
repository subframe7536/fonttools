import fs from 'node:fs'
import { loadPyodide } from 'pyodide'
import { build } from 'tsup'

const packageCacheDir = './cache'
const versionInfoPath = `${packageCacheDir}/PYODIDE_VERSION`

function cpAssets(name, transform, newName = name) {
  const data = fs.readFileSync(`./node_modules/pyodide/${name}`, 'utf-8')
  const content = transform ? transform(data) : data
  fs.writeFileSync(`./dist/${newName}`, content)
}

function cpCachedWhl(fileNames) {
  for (const name of fileNames) {
    fs.cpSync(`./cache/${name}`, `./dist/${name}`)
  }
}

const commonConfig = {
  format: ['esm'],
  dts: true,
  treeshake: true,
  external: ['vite', 'esbuild'],
}

loadPyodide({ packageCacheDir })
  .then((api) => {
    if (!fs.existsSync(versionInfoPath)) {
      console.log('No version info found, caching for the first time...')
      return api
    }
    if (api.version !== fs.readFileSync(versionInfoPath, 'utf-8')) {
      console.log('Version changed, recaching...')
      fs.rmdirSync(packageCacheDir, { recursive: true })
    }
    return api
  })
  .then(async api => (await api.loadPackage('brotli'), api))
  .then(async api => (await api.loadPackage('fonttools'), api))
  .then((api) => {
    if (!fs.existsSync(packageCacheDir)) {
      fs.mkdirSync(packageCacheDir)
    }
    fs.writeFileSync(versionInfoPath, api.version, 'utf-8')
  })
  .then(async () => {
    const files = fs.readdirSync('./cache')
    if (!files || files.length < 3) {
      throw new Error('No fonttools and brotli files')
    }
    try {
      fs.rmdirSync('./dist', { recursive: true })
    } catch {}

    cpCachedWhl(files)
    cpAssets('pyodide.asm.wasm')
    // cpAssets('pyodide.asm.js')
    // cpAssets(
    //   'pyodide.asm.js',
    //   data => data
    //     .replace(/require\("[^"]+"\)/g, '{}')
    //     .replace(/await import\("node:[^"]+"\)/g, '{}')
    //     .replace(/await import\("ws"\)/g, '{}')
    //     .replace(/await import\(/g, 'await import(/* @vite-ignore */')
    //     .replace('typeof window=="object"', 'false')
    //     .replace('typeof importScripts=="function"', 'false')
    //     .replace('typeof process=="object"&&typeof process.versions=="object"&&typeof process.versions.node=="string"', 'false')
    //     .replace('typeof process=="object"&&typeof process.versions=="object"&&typeof process.versions.node=="string"&&!process.browser', 'false'),
    //   'pyodide.web.asm.js',
    // )
    cpAssets(
      'pyodide.asm.js',
      data => data
        .replace('typeof process=="object"&&typeof process.versions=="object"&&typeof process.versions.node=="string"', 'true')
        .replace('typeof process=="object"&&typeof process.versions=="object"&&typeof process.versions.node=="string"&&!process.browser', 'true'),
    )
    cpAssets('pyodide-lock.json', (data) => {
      const json = JSON.parse(data)
      return JSON.stringify({
        ...json,
        packages: {
          brotli: json.packages.brotli,
          fonttools: json.packages.fonttools,
        },
      })
    })
    cpAssets('python_stdlib.zip')
    await build({
      ...commonConfig,
      entry: [
        'src/index.ts',
        'src/utils.ts',
      ],
      plugins: [
        {
          name: 'fix pyodide in node',
          renderChunk(code, { path }) {
            if (path.endsWith('index.js')) {
              return {
                code: code
                  .replace('typeof process == "object" && typeof process.versions == "object" && typeof process.versions.node == "string" && !process.browser', 'true')
                  .replace('typeof window == "object" && typeof document == "object" && typeof document.createElement == "function" && typeof sessionStorage == "object" && typeof importScripts != "function"', 'false')
                  .replace('typeof importScripts == "function" && typeof self == "object"', 'false')
                  .replace('typeof navigator == "object" && typeof navigator.userAgent == "string" && navigator.userAgent.indexOf("Chrome") == -1 && navigator.userAgent.indexOf("Safari") > -1', 'false'),
                // .replace(/let f.*pyodide.asm.js`;[\s\S]*await F\(f\);/, 'await import("./pyodide.node.asm.js");'),
                map: null,
              }
            }
          },
        },
      ],
    })
    await build({
      ...commonConfig,
      entry: [
        'src/web.ts',
      ],
      shims: false,
      plugins: [
        {
          name: 'fix pyodide in web',
          renderChunk(code, { path }) {
            if (path.endsWith('web.js')) {
              return {
                code: code
                  .replace('typeof Deno', 'undefined')
                  .replace('typeof process == "object" && typeof process.versions == "object" && typeof process.versions.node == "string" && !process.browser', 'false')
                  .replace('typeof window == "object" && typeof document == "object" && typeof document.createElement == "function" && typeof sessionStorage == "object" && typeof importScripts != "function"', 'true')
                  .replace('typeof importScripts == "function" && typeof self == "object"', 'false')
                  .replace(/c\(\w+, "node[^"]+"\);/g, '')
                  .replace(/c\(.*, "loadScript"\);/g, '()=>{}')
                  .replace(/let f.*pyodide.asm.js`;[\s\S]*await F\(f\);/, 'await import("./pyodide.web.asm.js");'),
                map: null,
              }
            }
          },
        },
      ],
    })
    await build({
      ...commonConfig,
      entry: {
        'pyodide.web.asm': './node_modules/pyodide/pyodide.asm.js',
      },
      external: ['ws'],
      plugins: [
        {
          name: 'optimize pyodide.asm.js for web',
          renderChunk(code, { path }) {
            if (path.endsWith('asm.js')) {
              return {
                code: code
                  .replace(/__require\("[^"]+"\)/g, '{}')
                  .replace(/__filename/g, 'undefined')
                  .replace(/require\("[^"]+"\)/g, '{}')
                  .replace(/await import\("node:[^"]+"\)/g, '{}')
                  .replace(/await import\("ws"\)/g, '{}')
                  .replace('typeof window == "object"', 'true')
                  .replace('typeof window == "object" && typeof document == "object" && typeof document.createElement == "function" && typeof sessionStorage == "object" && typeof importScripts != "function"', 'true')
                  .replace('typeof importScripts == "function"', 'false')
                  .replace('typeof Deno < "u"', 'false')
                  .replace('typeof process == "object" && typeof process.versions == "object" && typeof process.versions.node == "string"', 'false')
                  .replace('typeof importScripts == "function" && typeof self == "object", _r = typeof navigator == "object" && typeof navigator.userAgent == "string" && navigator.userAgent.indexOf("Chrome") == -1 && navigator.userAgent.indexOf("Safari") > -1', 'false')
                  .replace('typeof process == "object" && typeof process.versions == "object" && typeof process.versions.node == "string" && !process.browser', 'false')
                  .replace('throw new Error("Cannot determine runtime environment");', '{}')
                  .replace(/\s*\w*\(\w+, "node[^"]+"\);/g, '')
                  .replace(/\s*\w*\(.*, "loadScript"\);/g, '(false){}'),
                map: null,
              }
            }
          },
        },
      ],
    })
  })
