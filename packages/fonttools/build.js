import fs from 'node:fs'

import { loadPyodide } from 'pyodide'
import { build } from 'tsup'

const packageCacheDir = './cache'
const versionInfoPath = `${packageCacheDir}/PYODIDE_VERSION`

const entries = ['index', 'web', 'utils', 'vite']
const basicExports = Object.fromEntries(
  entries.map(k => [
    k === 'index' ? '.' : `./${k}`,
    {
      types: `./dist/${k}.d.ts`,
      import: `./dist/${k}.js`,
      default: `./dist/${k}.js`,
    },
  ]),
)

const typesVersions = {
  '*': Object.fromEntries(
    Object.entries(basicExports)
      .filter(e => e[0] !== '.')
      .map(([k, v]) => [k.substring(2), [v.types]]),
  ),
}

const extraAssetsExports = {}

/**
 * @param {string} name name
 * @param {(data: string) => string} transform fn
 */
function copyJsWithTransform(name, transform) {
  const data = fs.readFileSync(`./node_modules/pyodide/${name}`, 'utf-8')
  const content = transform ? transform(data) : data
  const targetPath = `./dist/${name}`
  extraAssetsExports[name] = targetPath
  fs.writeFileSync(targetPath, content)
}

/**
 * @param {string} name name
 */
function copyBinary(name) {
  const targetPath = `./dist/${name}`
  extraAssetsExports[name] = targetPath
  fs.cpSync(`./node_modules/pyodide/${name}`, targetPath)
}

/**
 * @param {string[]} fileNames file names
 */
function copyCachedWhl(fileNames) {
  for (const name of fileNames) {
    fs.cpSync(`./cache/${name}`, `./dist/${name}`)
  }
}

/**
 * @param {string[]} fileNames file names
 */
function checkCachedWhl(fileNames) {
  let count = 0
  for (const name of fileNames) {
    if ((name.startsWith('brotli') || name.startsWith('fonttools')) && name.endsWith('.whl')) {
      extraAssetsExports[name] = `./dist/${name}`
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

/**
 * @type {Exclude<import('tsup').Options['plugins'], undefined>[0]}
 */
const nodePlugin = {
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
}

/**
 * @type {Exclude<import('tsup').Options['plugins'], undefined>[0]}
 */
const webPlugin = {
  name: 'fix pyodide in web',
  renderChunk(code, { path }) {
    if (path.endsWith('web.js')) {
      return {
        code: code
          .replace(/c\(\w+, "node[^"]+"\);/g, '')
          .replaceAll('await import(', 'await import(/*@vite-ignore*/')
          .replace('typeof Deno', 'undefined')
          .replace('typeof Bun', 'undefined')
          .replace(/typeof process\s*==\s*"object"\s*&&\s*typeof process.versions\s*==\s*"object"\s*&&\s*typeof process.versions.node\s*==\s*"string"\s*&&\s*!process.browser/, 'false')
          .replace(/typeof navigator\s*==\s*"object"\s*&&\s*typeof navigator.userAgent\s*==\s*"string"\s*&&\s*navigator.userAgent.indexOf("Chrome")\s*==\s*-1\s*&&\s*navigator.userAgent.indexOf("Safari") > -1/, '')
          .replace('Cannot determine runtime environment', 'Only support load in browser')
          .replace('pyodide.asm.js', 'pyodide.web.asm.js'),
        map: null,
      }
    }
  },
}

/**
 * @type {Exclude<import('tsup').Options['plugins'], undefined>[0]}
 */
const asmJsWebPlugin = {
  name: 'optimize pyodide.asm.js for web',
  renderChunk(code, { path }) {
    if (path.endsWith('asm.js')) {
      extraAssetsExports['pyodide.web.asm.js'] = './dist/pyodide.web.asm.js'
      const trimmedCode = code
        .replace(/__require\("[^"]+"\)/g, '{}')
        .replace(/__filename/g, 'undefined')
        .replace(/require\("[^"]+"\)/g, '{}')
        .replace(/await import\("node:[^"]+"\)/g, '{}')
        .replace(/await import\("ws"\)/g, '{}')
        .replace('typeof Deno < "u"', 'false')
        .replace(/typeof process == "object" && typeof process.versions == "object" && typeof process.versions.node == "string" && !process.browser/g, 'false')
        .replace(/typeof process == "object" && typeof process.versions == "object" && typeof process.versions.node == "string"/g, 'false')
        .replace(/typeof process == "object"/g, 'false')
        .replace('throw new Error("Cannot determine runtime environment");', ';')
        .replace('Module["NODEFS"] = NODEFS;', '')
        .replace('"NODEFS": NODEFS,', '')
        .replace(
          /(\w+\(.*\))\.config\.indexURL/,
          (_, prefix) => {
            const [_node, _web] = prefix.split(':').map(s => s.trim())
            return `${_node} : (${_web}.config.whlURL || ${_web}.config.indexURL)`
          },
        )
        .replace(/\s*\w*\(\w+,\s*"node[^"]+"\);/g, '')
        .replace(/\s*\w*\(\w+,\s*"NodeReader"\);/, '')
        .replace(/\s*\w*\(\w+,\s*"NodeWriter"\);/, '')
        .replace(/\s*\w*\(.*,\s*"loadScript"\);/g, '(false){}')
        .replace('Module["IDBFS"] = IDBFS;', '')
        .replace('"IDBFS": IDBFS,', '')

      return {
        code: trimmedCode,
        map: null,
      }
    }
  },
}

loadPyodide({ packageCacheDir })
  .then((api) => {
    if (!fs.existsSync(versionInfoPath)) {
      console.log('No version info found, caching for the first time...')
      return api
    }
    if (api.version !== fs.readFileSync(versionInfoPath, 'utf-8')) {
      console.log('Version changed, recaching...')
      fs.rmSync(packageCacheDir, { recursive: true })
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
      fs.rmSync('./dist', { recursive: true })
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
      minify: true,
      plugins: [nodePlugin],
    })

    await build({
      ...commonConfig,
      entry: [
        'src/web.ts',
      ],
      minify: true,
      shims: false,
      cjsInterop: false,
      external: ['ws', /node:.*/],
      plugins: [webPlugin],
    })

    await build({
      ...commonConfig,
      entry: {
        'pyodide.web.asm': './node_modules/pyodide/pyodide.asm.js',
      },
      dts: false,
      external: ['ws', /node:.*/],
      plugins: [asmJsWebPlugin],
    })

    await build({
      ...commonConfig,
      entry: ['./dist/pyodide.web.asm.js'],
      dts: false,
      minify: true,
      plugins: [
        {
          name: 'fxxk-vite',
          renderChunk: (code) => {
            return {
              code: code.replace(
                /await import\(/g,
                'await import(/* @vite-ignore */',
              ),
            }
          },
        },
      ],
    })

    await build({
      ...commonConfig,
      entry: [
        'src/vite.ts',
      ],
      define: {
        __ASSETS__: JSON.stringify(
          Object.keys(extraAssetsExports).filter(e => e !== 'pyodide.asm.js'),
        ),
      },
    })
    const packageJson = JSON.parse(fs.readFileSync('./package.json'))
    packageJson.typesVersions = typesVersions
    packageJson.exports = {
      ...basicExports,
      ...Object.fromEntries(Object.entries(extraAssetsExports).map(([k, v]) => [`./${k}`, v])),
    }
    fs.writeFileSync('./package.json', `${JSON.stringify(packageJson, null, 2)}\n`)
  })
