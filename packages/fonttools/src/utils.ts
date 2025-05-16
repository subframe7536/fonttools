import type { LiteralOrString } from '@subframe7536/type-utils'
import type { PyodideInterface } from 'pyodide'

export type ScriptGenerator = (inputPath: string, outputPath: string) => string

/**
 * Generate a basic script for fonttools
 *
 * `font` is a `fontTools.ttLib.TTFont` object
 */
export function generateBasicScript(script: string): ScriptGenerator {
  return (input, output) => `from fontTools.ttLib import TTFont
font = TTFont('${input}')
${script}
font.save('${output}')`
}

export type Extension = {
  input?: LiteralOrString<'ttf' | 'otf' | 'woff' | 'woff2'>
  output?: LiteralOrString<'ttf' | 'otf' | 'woff' | 'woff2'>
}

/**
 * Run a Python script in `pyodide` with input ttf and return processed ttf buffer
 * @param pyodide pyodide instance
 * @param inputBuffer original font buffer, common format is `Uint8Array`
 * @param script script string, `font` is `fonttools.ttLib.TTFont` variable
 * @param ext input / output font format. Default input is 'ttf', default output is same as input
 */
export function handleFontBuffer(
  pyodide: PyodideInterface,
  inputBuffer: ArrayBuffer | ArrayBufferView,
  script: ScriptGenerator,
  ext: Extension = {},
): Uint8Array {
  const { input = 'ttf', output = input } = ext
  const inputPath = `/tmp/input.${input}`
  const outputPath = `/tmp/output.${output}`

  try {
    pyodide.FS.writeFile(
      inputPath,
      inputBuffer instanceof ArrayBuffer ? new Uint8Array(inputBuffer) : inputBuffer,
    )

    const pythonCode = script(inputPath, outputPath)
    pyodide.runPython(pythonCode)

    const outputBuffer = pyodide.FS.readFile(outputPath)
    return outputBuffer
  } finally {
    try {
      pyodide.FS.unlink(inputPath)
      pyodide.FS.unlink(outputPath)
    } catch {}
  }
}

/**
 * Name Id for `name` table, see details in {@link https://learn.microsoft.com/en-us/typography/opentype/spec/name#name-ids SPEC}
 */
export const NameId = {
  Copyright: 0,
  FamilyName: 1,
  SubfamilyName: 2,
  Identifier: 3,
  FullName: 4,
  Version: 5,
  PostscriptName: 6,
  Trademark: 7,
  Manufacturer: 8,
  Designer: 9,
  Description: 10,
  VenderURL: 11,
  DesignerURL: 12,
  License: 13,
  LicenseURL: 14,
  PreferredFamily: 16,
  PreferredSubFamily: 17,
} as const

/**
 * Script that contains utils that manipulate font's name
 */
export const processNameUtilScript = `def set_font_name(font,name,id):
    font["name"].setName(name,nameID=id,platformID=1,platEncID=0,langID=0x0)
    font["name"].setName(name,nameID=id,platformID=3,platEncID=1,langID=0x409)
def get_font_name(font,id):
    return font["name"].getName(nameID=id,platformID=3,platEncID=1,langID=0x409).__str__()
def del_font_name(font,id):
    font["name"].removeNames(nameID=id)`
