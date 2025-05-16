import type { Plugin } from 'vite'

import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

import { createLogger } from 'vite'

declare const __ASSETS__: string[]

export const assetsKey = {
  brotli: '$brotli',
  fonttools: '$fonttools',
  wasm: '$wasm',
  asmjs: '$asmjs',
  zip: '$zip',
  lock: '$lock',
} as const

const logger = createLogger('info', { prefix: '[fonttools]' })

export type AssetsKey = typeof assetsKey[keyof typeof assetsKey]

export interface FonttoolsPluginOptions {
  /**
   * Custom URL for assets.
   *
   * There are 6 assets that the plugin handled:
   * - 2 `.whl` file: For `fonttools` and `brotli`(for `woff2`)
   * - 1 lock file: Load `.whl`
   * - 1 asm.js file: EMScript generated file
   * - 1 asm.wasm file: EMScript generated file
   * - 1 zip file: Python stdlibs
   *
   * And importer that use `loadInBrowser` imports lock file, asm.js, asm.wasm and zip file
   *
   * Final loaded url pattern: `{indexURL}{urlPrefix}{assetsName}`
   *
   * By default, all the assets is loaded from the same directory as importer in production.
   * You should set it if your `build.assetsDir` or `build.rollupOptions.output.assetFileNames` is modified.
   *
   * @param currentAssetsKey key to access `originalAssetsPathMap` and `finalAssetsPathMap`
   * @param assetsNameMap assets name map, use `currentAssetsKey` to get file name
   * @param finalAssetsPathMap final assets path map, use `currentAssetsKey` to get final file path
   * @param importer [importerPath, importerCode]
   * @example
   * // assert your `assetsDir` is default
   * // and productionURL is 'https://example.com/project'
   * handleURL = (key, originalMap, finalMap) => `deep/${finalMap(key)![0]}`
   * // your finalWasmURL is 'https://example.com/project/deep/assets/pyodide.asm-[hash].wasm'
   */
  customURL?: (
    currentAssetsKey: AssetsKey,
    assetsNameMap: Map<AssetsKey, string>,
    finalAssetsPathMap: Map<AssetsKey, [path: string, source: string | Uint8Array]>,
    importer: [path: string, code: string]
  ) => string
  /**
   * Transform code in `pyodide.web.asm.js`
   */
  transformAsmJs?: (code: string) => string | undefined | null | void
}

/**
 * Vite plugin for `@subframe7536/fonttools/web`, emit missing assets
 */
export function fonttools(options: FonttoolsPluginOptions = {}): Plugin[] {
  const {
    customURL = (key, _, finalMap) => path.basename(finalMap.get(key)![0]),
    transformAsmJs,
  } = options
  const fonttoolsDistRoot = path.dirname(createRequire(import.meta.url).resolve('@subframe7536/fonttools'))
  const assetsNameMap = new Map<AssetsKey, string>()
  const finalAssetsPathMap = new Map<AssetsKey, [path: string, source: string | Uint8Array]>()
  const importers: [path: string, code: string][] = []
  let outputDir = 'dist'
  return [
    {
      name: 'vite-plugin-fonttools-exclude',
      enforce: 'pre',
      config(config) {
        config.optimizeDeps?.exclude?.push('@subframe7536/fonttools')
      },
    },
    {
      name: 'vite-plugin-fonttools',
      apply: 'build',
      enforce: 'post',
      buildStart() {
        for (const fileName of __ASSETS__) {
          let key: AssetsKey | undefined
          switch (true) {
            case fileName.startsWith('Brotli'):
              key = assetsKey.brotli
              break
            case fileName.startsWith('fonttools'):
              key = assetsKey.fonttools
              break
            case fileName.includes('web.asm'):
              key = assetsKey.asmjs
              break
            case fileName.includes('wasm'):
              key = assetsKey.wasm
              break
            case fileName.includes('zip'):
              key = assetsKey.zip
              break
            case fileName.includes('lock'):
              key = assetsKey.lock
              break
            default:
              logger.warn(`Unknown assets: ${fileName}`, { timestamp: true })
          }
          if (key) {
            assetsNameMap.set(key, fileName)
          }
          this.emitFile({
            type: 'asset',
            name: fileName,
            originalFileName: key,
            source: fs.readFileSync(
              path.join(fonttoolsDistRoot, fileName),
              fileName.endsWith('.js') ? 'utf-8' : undefined,
            ),
          })
        }
      },
      writeBundle(options, bundle) {
        if (options.dir) {
          outputDir = options.dir
        }
        for (const [filePath, info] of Object.entries(bundle)) {
          if (info.type === 'chunk') {
            if (info.code.includes('pyodide.web.asm.js')) {
              importers.push([path.join(outputDir, filePath), info.code])
            }
          } else {
            const key = info.originalFileNames[0] as AssetsKey
            if (assetsNameMap.has(key)) {
              finalAssetsPathMap.set(key, [filePath, info.source])
            }
          }
        }
      },
      closeBundle() {
        if (importers.length < 1) {
          logger.warn(`No importer found, skip`, { timestamp: true })
          return
        }

        for (const importer of importers) {
          const [importerPath, importerCode] = importer
          const [lockFilePath, lockFileSource] = finalAssetsPathMap.get(assetsKey.lock)!
          const json = JSON.parse(lockFileSource as string)
          json.packages.brotli.file_name = customURL(
            assetsKey.brotli,
            assetsNameMap,
            finalAssetsPathMap,
            importer,
          )
          json.packages.fonttools.file_name = customURL(
            assetsKey.fonttools,
            assetsNameMap,
            finalAssetsPathMap,
            importer,
          )
          const lockFileFinalPath = path.join(outputDir, lockFilePath)
          fs.writeFileSync(lockFileFinalPath, JSON.stringify(json))
          logger.info(`Update lock file: ${lockFileFinalPath}`, { timestamp: true })

          const updatedImporterCode = importerCode
            .replace(
              assetsNameMap.get(assetsKey.asmjs)!,
              customURL(assetsKey.asmjs, assetsNameMap, finalAssetsPathMap, importer),
            )
            .replace(
              assetsNameMap.get(assetsKey.wasm)!,
              customURL(assetsKey.wasm, assetsNameMap, finalAssetsPathMap, importer),
            )
            .replace(
              assetsNameMap.get(assetsKey.zip)!,
              customURL(assetsKey.zip, assetsNameMap, finalAssetsPathMap, importer),
            )
            .replace(
              assetsNameMap.get(assetsKey.lock)!,
              customURL(assetsKey.lock, assetsNameMap, finalAssetsPathMap, importer),
            )

          fs.writeFileSync(importerPath, updatedImporterCode)
          logger.info(`Update importer: ${importerPath}`, { timestamp: true })
        }

        const asmJsPath = finalAssetsPathMap.get(assetsKey.asmjs)![0]
        if (typeof transformAsmJs === 'function') {
          const code = fs.readFileSync(asmJsPath, 'utf-8')
          const updatedCode = transformAsmJs(code)
          if (updatedCode) {
            fs.writeFileSync(asmJsPath, updatedCode, 'utf-8')
          }
        }
      },
    },
  ]
}
