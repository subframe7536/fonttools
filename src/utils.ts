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
font.save('${output}')
    `
}

/**
 * Run a Python script in `pyodide`
 */
export async function handleFontBuffer(
  pyodide: PyodideInterface,
  inputBuffer: Uint8Array,
  script: ScriptGenerator,
): Promise<Uint8Array> {
  const inputPath = '/tmp/input.ttf'
  const outputPath = '/tmp/output.ttf'

  pyodide.FS.writeFile(inputPath, inputBuffer)

  const pythonCode = script(inputPath, outputPath)
  await pyodide.runPythonAsync(pythonCode)

  const outputBuffer = pyodide.FS.readFile(outputPath)
  pyodide.FS.unlink(inputPath)
  pyodide.FS.unlink(outputPath)

  return outputBuffer
}
