## @subframe7536/fonttools

`fonttools` for nodejs or web powered by `pyodide`, compatible with `vite`

Under development, breaking changes expected. Use at your own risk

- `pyodide` version: `0.26.3`

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

### Credit

pyodide

### License

MIT
