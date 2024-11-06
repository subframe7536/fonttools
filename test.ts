/* eslint-disable antfu/no-import-dist */
import { readFileSync, writeFileSync } from 'node:fs'
import { loadInNode } from './src'
import { generateBasicScript, handleFontBuffer } from './src/utils'
// import { loadInNode } from './dist'
// import { generateBasicScript, handleFontBuffer } from './dist/utils'

const buf = new Uint8Array(readFileSync('./test.ttf'))

loadInNode({ packageCacheDir: './cache', woff2: true })
  .then(py => (handleFontBuffer(py, buf, generateBasicScript(`
def set_font_name(font: TTFont, name: str, id: int):
    font["name"].setName(name, nameID=id, platformID=1, platEncID=0, langID=0x0)
    font["name"].setName(name, nameID=id, platformID=3, platEncID=1, langID=0x409)
set_font_name(font, 'Test', 1)
`)), py))
  .then(py => handleFontBuffer(py, buf, (input, output) => `from fontTools.ttLib.woff2 import compress
compress('${input}', '${output}')
`))
  .then(data => writeFileSync('output.woff2', data))
