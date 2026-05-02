import type { JsonType } from './types'

export function getJsonType(value: unknown): JsonType {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'

  const tag = Object.prototype.toString.call(value)

  // Boxed primitives: new String("true") has typeof "object" but should be treated as string
  if (tag === '[object String]') return 'string'
  if (tag === '[object Number]') return 'number'
  if (tag === '[object Boolean]') return 'boolean'

  if (typeof value === 'string') return 'string'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'symbol') return 'symbol'
  if (typeof value === 'bigint') return 'bigint'
  if (typeof value === 'function') return 'function'

  if (Array.isArray(value)) return 'array'

  if (tag === '[object Date]') return 'date'
  if (tag === '[object RegExp]') return 'regexp'

  return 'object'
}

export function isExpandable(type: JsonType): boolean {
  return type === 'object' || type === 'array'
}

export function stringifyValue(value: unknown, maxLength?: number): string {
  let result: string

  // Unwrap boxed primitives first
  if (value instanceof String) {
    result = JSON.stringify(value.valueOf())
  } else if (value instanceof Number) {
    result = String(value.valueOf())
  } else if (value instanceof Boolean) {
    result = String(value.valueOf())
  } else if (value === null) {
    result = 'null'
  } else if (value === undefined) {
    result = 'undefined'
  } else if (typeof value === 'string') {
    result = JSON.stringify(value)
  } else if (typeof value === 'bigint') {
    result = `${value}n`
  } else if (typeof value === 'symbol') {
    result = value.toString()
  } else if (typeof value === 'function') {
    const name = (value as (...args: unknown[]) => unknown).name || 'anonymous'
    result = `[Function: ${name}]`
  } else if (value instanceof Date) {
    result = value.toISOString()
  } else if (value instanceof RegExp) {
    result = value.toString()
  } else {
    result = String(value)
  }

  if (maxLength !== undefined && result.length > maxLength) {
    return `${result.slice(0, maxLength)}…`
  }

  return result
}

export function isObjectOrArray(val: unknown): val is Record<string, unknown> | unknown[] {
  if (val === null || val === undefined) return false
  if (typeof val !== 'object') return false
  // Exclude boxed primitives — they are not expandable containers
  const tag = Object.prototype.toString.call(val)
  if (tag === '[object String]' || tag === '[object Number]' || tag === '[object Boolean]') return false
  return true
}
