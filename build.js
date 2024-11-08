import fs from 'node:fs'
import { loadPyodide } from 'pyodide'
import { build } from 'tsup'

const packageCacheDir = './cache'
const versionInfoPath = `${packageCacheDir}/PYODIDE_VERSION`

function copyJsWithTransform(name, transform) {
  const data = fs.readFileSync(`./node_modules/pyodide/${name}`, 'utf-8')
  const content = transform ? transform(data) : data
  fs.writeFileSync(`./dist/${name}`, content)
}
function copyBinary(name, newName = name) {
  fs.cpSync(`./node_modules/pyodide/${name}`, `./dist/${newName}`)
}

function copyCachedWhl(fileNames) {
  for (const name of fileNames) {
    fs.cpSync(`./cache/${name}`, `./dist/${name}`)
  }
}

function checkCachedWhl(fileNames) {
  let count = 0
  for (const name of fileNames) {
    if ((name.startsWith('Brotli') || name.startsWith('fonttools')) && name.endsWith('.whl')) {
      count++
    }
  }
  if (fileNames.length < 3 || count < 2) {
    throw new Error('No fonttools and brotli `.whl` file found')
  }
}

/**
 * @type {import('tsup').Options}
 */
const commonConfig = {
  format: ['esm'],
  dts: { resolve: true },
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
    console.log('target `pyodide` version:', api.version)
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
    checkCachedWhl(files)
    try {
      fs.rmdirSync('./dist', { recursive: true })
    } catch {}

    copyCachedWhl(files)
    copyBinary('pyodide.asm.wasm')
    copyBinary('python_stdlib.zip')
    copyJsWithTransform('pyodide.asm.js')
    copyJsWithTransform(
      'pyodide-lock.json',
      (data) => {
        const json = JSON.parse(data)
        return JSON.stringify({
          ...json,
          packages: {
            brotli: json.packages.brotli,
            fonttools: json.packages.fonttools,
          },
        })
      },
    )
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
                  .replace(/typeof process\s*==\s*"object"\s*&&\s*typeof process.versions\s*==\s*"object"\s*&&\s*typeof process.versions.node\s*==\s*"string"\s*&&\s*!process.browser/, 'true')
                  .replace(/typeof window\s*==\s*"object"\s*&&\s*typeof document\s*==\s*"object"\s*&&\s*typeof document.createElement\s*==\s*"function"\s*&&\s*typeof sessionStorage\s*==\s*"object"\s*&&\s*typeof importScripts\s*!=\s*"function"/, 'false')
                  .replace(/typeof importScripts\s*==\s*"function"\s*&&\s*typeof self\s*==\s*"object"/, 'false')
                  .replace(/typeof navigator\s*==\s*"object"\s*&&\s*typeof navigator.userAgent\s*==\s*"string"\s*&&\s*navigator.userAgent.indexOf("Chrome")\s*==\s*-1\s*&&\s*navigator.userAgent.indexOf("Safari")\s*>\s*-1/, 'false'),
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
                  .replace(/typeof process\s*==\s*"object"\s*&&\s*typeof process.versions\s*==\s*"object"\s*&&\s*typeof process.versions.node\s*==\s*"string"\s*&&\s*!process.browser/, 'false')
                  .replace('typeof window == "object" && typeof document == "object" && typeof document.createElement == "function" && typeof sessionStorage == "object" && typeof importScripts != "function"', 'true')
                  .replace('typeof importScripts == "function" && typeof self == "object";', 'true')
                  .replace('typeof navigator == "object" && typeof navigator.userAgent == "string" && navigator.userAgent.indexOf("Chrome") == -1 && navigator.userAgent.indexOf("Safari") > -1"', '')
                  .replace(/c\(.*, "loadScript"\);/g, '{}')
                  .replace(/let f.*pyodide.asm.js`;[\s\S]*await F\(f\);/, 'typeof importScript === "function" ? importScripts("./pyodide.web.asm.js") : await import("./pyodide.web.asm.js");')
                  .replace(/c\(\w+, "node[^"]+"\);/g, ''),
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
      dts: false,
      minify: false,
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
                  // .replaceAll('await import(', 'await import(/*@vite-ignore*/')
                  .replace('typeof importScripts == "function" && typeof self == "object", _r = typeof navigator == "object" && typeof navigator.userAgent == "string" && navigator.userAgent.indexOf("Chrome") == -1 && navigator.userAgent.indexOf("Safari") > -1', 'false')
                  .replace('typeof process == "object" && typeof process.versions == "object" && typeof process.versions.node == "string" && !process.browser', 'false')
                  .replace('throw new Error("Cannot determine runtime environment");', '{}')
                  .replace(/\s*\w*\(\w+,\s*"node[^"]+"\);/g, '')
                  .replace(/\s*\w*\(.*,\s*"loadScript"\);/g, '(false){}'),
                map: null,
              }
            }
          },
        },
      ],
    })
    await build({
      ...commonConfig,
      entry: ['./dist/pyodide.web.asm.js'],
      dts: false,
      minify: true,
    })
  })
