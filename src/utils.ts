import type { PyodideInterface } from 'pyodide'

type ScriptGenerator = (inputPath: string, outputPath: string) => string

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

/**
 * Run a Python script in `pyodide` with input ttf and return processed ttf buffer
 * @param pyodide pyodide instance
 * @param inputBuffer original TTF font buffer
 * @param script script string, `font` is `fonttools.ttLib.TTFont` variable
 */
export async function handleFontBuffer(
  pyodide: PyodideInterface,
  inputBuffer: Uint8Array,
  script: ScriptGenerator,
): Promise<Uint8Array> {
  const inputPath = '/tmp/input.ttf'
  const outputPath = '/tmp/output.ttf'

  try {
    pyodide.FS.writeFile(inputPath, inputBuffer)

    const pythonCode = script(inputPath, outputPath)
    await pyodide.runPythonAsync(pythonCode)

    const outputBuffer = pyodide.FS.readFile(outputPath)
    return outputBuffer
  } finally {
    pyodide.FS.unlink(inputPath)
    pyodide.FS.unlink(outputPath)
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
