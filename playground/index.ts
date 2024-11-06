// import { generateBasicScript, handleFontBuffer } from '../src/utils'
// import { loadInBrowser } from '../src/web'
import { generateBasicScript, handleFontBuffer } from '../dist/utils'
import { loadInBrowser } from '../dist/web'
import src from './test.ttf'

const buf = await (await fetch(src)).arrayBuffer()
const py = await loadInBrowser()
const data = await handleFontBuffer(py, new Uint8Array(buf), generateBasicScript(`
def set_font_name(font: TTFont, name: str, id: int):
    font["name"].setName(name, nameID=id, platformID=1, platEncID=0, langID=0x0)
    font["name"].setName(name, nameID=id, platformID=3, platEncID=1, langID=0x409)
set_font_name(font, 'Test', 1)
`))
const url = URL.createObjectURL(new Blob([data]))
// download
const a = document.createElement('a')
a.href = url
a.download = 'output.ttf'
a.click()
a.remove()
