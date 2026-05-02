export interface JsonNodeProps {
  keyName: string | number | null
  value: unknown
  depth: number
  path: string
  maxDepth: number
  maxRenderDepth: number
  collapsedNodeLength: number
  maxStringLength: number
  showCopy: boolean
  visited: WeakSet<object>
}

export type JsonType =
  | 'object'
  | 'array'
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'undefined'
  | 'date'
  | 'regexp'
  | 'function'
  | 'symbol'
  | 'bigint'
