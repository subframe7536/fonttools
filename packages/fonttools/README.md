## @subframe7536/fonttools

`fonttools` for nodejs or web with `vite` plugin, powered by `pyodide`

ESM Only

Under development, breaking changes expected. Use at your own risk

- `pyodide` version: `0.27.1`

### Why

The `fonttools` binary file is not included in `pyodide` by default, you need to download it from JsDelivr at runtime, and the URL seems not allowed to customize. So I package all the needed file and provide a `vite` plugin to optimize.

### Install

```shell
npm install @subframe7536/fonttools
```
```shell
yarn add @subframe7536/fonttools
```
```shell
pnpm add @subframe7536/fonttools
```

### Usage

#### NodeJS

```ts
import { readFileSync, writeFileSync } from 'node:fs'

import { loadInNode } from '@subframe7536/fonttools'
import { generateBasicScript, handleFontBuffer, NameId, processNameScriptUtil } from '@subframe7536/fonttools/utils'

const buf = new Uint8Array(readFileSync('./test.ttf'))

loadInNode({ woff2: true })
  .then(async (py) => {
    const data = await handleFontBuffer(
      py,
      buf,
      generateBasicScript(`${processNameScriptUtil}
set_font_name(font, 'Test', ${NameId.FamilyName})
`)
    )
    writeFileSync('change_name.ttf', data)
    return py
  })
  .then(async (py) => {
    const data = await handleFontBuffer(
      py,
      buf,
      (input, output) => `
from fontTools.ttLib.woff2 import compress
compress('${input}', '${output}')
`
    )
    writeFileSync('output.woff2', data)
  })
```

#### Web

```ts
import { generateBasicScript, handleFontBuffer, NameId } from '@subframe7536/fonttools/utils'
import { loadInBrowser } from '@subframe7536/fonttools/web'

import src from './test.ttf'

const buf = await (await fetch(src)).arrayBuffer()
const py = await loadInBrowser()
const data = await handleFontBuffer(
  py,
  new Uint8Array(buf),
  generateBasicScript(`
def set_font_name(font: TTFont, name: str, id: int):
    font["name"].setName(name, nameID=id, platformID=1, platEncID=0, langID=0x0)
    font["name"].setName(name, nameID=id, platformID=3, platEncID=1, langID=0x409)
set_font_name(font, 'Test', ${NameId.FamilyName})
`),
)
// download
const url = URL.createObjectURL(new Blob([data]))
const a = document.createElement('a')
a.href = url
a.download = 'output.ttf'
a.click()
a.remove()
```

### Vite Plugin

Copy assets to root while building

```ts
import { fonttools } from '@subframe7536/fonttools/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [fonttools()],
})
```

#### Custom URL

There are 6 assets that the plugin handled:
- 2 `.whl` file: For `fonttools` and `brotli`(for `woff2`)
- 1 lock file: Load `.whl`
- 1 asm.js file: EMScript generated file
- 1 asm.wasm file: EMScript generated file
- 1 zip file: Python stdlibs

And importer that use `loadInBrowser` imports lock file, asm.js, asm.wasm and zip file

Final loaded url pattern: `{indexURL}{urlPrefix}{assetsName}`

By default, all the assets is loaded from the same directory as importer in production.
You should set it if your `build.assetsDir` or `build.rollupOptions.output.assetFileNames` is modified.

So, here is a example to custom assets url:

```ts
fonttools({
  customURL: (
    currentAssetsKey: AssetsKey,
    assetsNameMap: Map<AssetsKey, string>,
    finalAssetsPathMap: Map<AssetsKey, [path: string, source: string | Uint8Array]>,
    importer: [path: string, code: string]
  ) => `deep/${finalAssetsPathMap.get(currentAssetsKey)![0]}`
})
```

### CDN Example

See in [cdn.html](./cdn.html)

For [esm.sh](https://esm.sh), you may need to setup `options.stdlibURL` and `options.whlURL` to correctly load

### Credit

pyodide

### License

MIT
