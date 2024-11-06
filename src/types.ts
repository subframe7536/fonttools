import type { loadPyodide } from 'pyodide'

export type LoadOption = Omit<
  Exclude<Parameters<typeof loadPyodide>[0], undefined>,
  'packages'
> & {
  /**
   * Whether to load `brotli` package to handle `woff2` format
   */
  woff2?: boolean
}
export type LoadInWebOption = Omit<LoadOption, 'packageCacheDir'>

export type LoadInNodeOption = Omit<LoadOption, 'indexURL'>
