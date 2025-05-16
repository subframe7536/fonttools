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
export type LoadInBrowserOption = Omit<LoadOption, 'packageCacheDir' | '_node_mounts'> & {
  /**
   * URL for `.whl` file. Browser only.
   *
   * Target URL example: `new URL('fonttools-4.51.0-py3-none-any.whl', whlURL || location)`
   * @default option.indexURL
   */
  whlURL?: string
}

export type LoadInNodeOption = Omit<LoadOption, 'indexURL'>
