import { sortBy } from 'lodash-es'

import { readFileAsync } from './misc.js'

const TOP_LEVEL_NAMESPACE = '__TOP_LEVEL_MODULE__'
export const DEFAULT_TYPE_DEF_HEADER = `/* auto-generated by NAPI-RS */
/* eslint-disable */
`

enum TypeDefKind {
  Const = 'const',
  Enum = 'enum',
  StringEnum = 'string_enum',
  Interface = 'interface',
  Type = 'type',
  Fn = 'fn',
  Struct = 'struct',
  Impl = 'impl',
}

interface TypeDefLine {
  kind: TypeDefKind
  name: string
  original_name?: string
  def: string
  js_doc?: string
  js_mod?: string
}

function prettyPrint(
  line: TypeDefLine,
  constEnum: boolean,
  ident: number,
  ambient = false,
): string {
  let s = line.js_doc ?? ''
  switch (line.kind) {
    case TypeDefKind.Interface:
      s += `export interface ${line.name} {\n${line.def}\n}`
      break

    case TypeDefKind.Type:
      s += `export type ${line.name} = \n${line.def}`
      break

    case TypeDefKind.Enum:
      const enumName = constEnum ? 'const enum' : 'enum'
      s += `${exportDeclare(ambient)} ${enumName} ${line.name} {\n${line.def}\n}`
      break

    case TypeDefKind.StringEnum:
      if (constEnum) {
        s += `${exportDeclare(ambient)} const enum ${line.name} {\n${line.def}\n}`
      } else {
        s += `export type ${line.name} = ${line.def.replaceAll(/.*=/g, '').replaceAll(',', '|')};`
      }
      break

    case TypeDefKind.Struct:
      s += `${exportDeclare(ambient)} class ${line.name} {\n${line.def}\n}`
      if (line.original_name && line.original_name !== line.name) {
        s += `\nexport type ${line.original_name} = ${line.name}`
      }
      break

    case TypeDefKind.Fn:
      s += `${exportDeclare(ambient)} ${line.def}`
      break

    default:
      s += line.def
  }

  return correctStringIdent(s, ident)
}

function exportDeclare(ambient: boolean): string {
  if (ambient) {
    return 'export'
  }

  return 'export declare'
}

export async function processTypeDef(
  intermediateTypeFile: string,
  constEnum: boolean,
  header?: string,
) {
  const exports: string[] = []
  const defs = await readIntermediateTypeFile(intermediateTypeFile)
  const groupedDefs = preprocessTypeDef(defs)

  header = header ?? ''
  let dts = ''

  sortBy(Array.from(groupedDefs), ([namespace]) => namespace).forEach(
    ([namespace, defs]) => {
      if (namespace === TOP_LEVEL_NAMESPACE) {
        for (const def of defs) {
          dts += prettyPrint(def, constEnum, 0) + '\n\n'
          switch (def.kind) {
            case TypeDefKind.Const:
            case TypeDefKind.Enum:
            case TypeDefKind.StringEnum:
            case TypeDefKind.Fn:
            case TypeDefKind.Struct: {
              exports.push(def.name)
              if (def.original_name && def.original_name !== def.name) {
                exports.push(def.original_name)
              }
              break
            }
            default:
              break
          }
        }
      } else {
        exports.push(namespace)
        dts += `export declare namespace ${namespace} {\n`
        for (const def of defs) {
          dts += prettyPrint(def, constEnum, 2, true) + '\n'
        }
        dts += '}\n\n'
      }
    },
  )

  if (dts.indexOf('ExternalObject<') > -1) {
    header += `
export declare class ExternalObject<T> {
  readonly '': {
    readonly '': unique symbol
    [K: symbol]: T
  }
}
`
  }

  return {
    dts: header + dts,
    exports,
  }
}

async function readIntermediateTypeFile(file: string) {
  const content = await readFileAsync(file, 'utf8')
  const defs = content
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      line = line.trim()
      if (!line.startsWith('{')) {
        // crateName:{ "def": "", ... }
        const start = line.indexOf(':') + 1
        line = line.slice(start)
      }
      return JSON.parse(line) as TypeDefLine
    })

  // move all `struct` def to the very top
  // and order the rest alphabetically.
  return defs.sort((a, b) => {
    if (a.kind === TypeDefKind.Struct) {
      if (b.kind === TypeDefKind.Struct) {
        return a.name.localeCompare(b.name)
      }
      return -1
    } else if (b.kind === TypeDefKind.Struct) {
      return 1
    } else {
      return a.name.localeCompare(b.name)
    }
  })
}

function preprocessTypeDef(defs: TypeDefLine[]): Map<string, TypeDefLine[]> {
  const namespaceGrouped = new Map<string, TypeDefLine[]>()
  const classDefs = new Map<string, TypeDefLine>()

  for (const def of defs) {
    const namespace = def.js_mod ?? TOP_LEVEL_NAMESPACE
    if (!namespaceGrouped.has(namespace)) {
      namespaceGrouped.set(namespace, [])
    }

    const group = namespaceGrouped.get(namespace)!

    if (def.kind === TypeDefKind.Struct) {
      group.push(def)
      classDefs.set(def.name, def)
    } else if (def.kind === TypeDefKind.Impl) {
      // merge `impl` into class definition
      const classDef = classDefs.get(def.name)
      if (classDef) {
        if (classDef.def) {
          classDef.def += '\n'
        }

        classDef.def += def.def
      }
    } else {
      group.push(def)
    }
  }

  return namespaceGrouped
}

export function correctStringIdent(src: string, ident: number): string {
  let bracketDepth = 0
  const result = src
    .split('\n')
    .map((line) => {
      line = line.trim()
      if (line === '') {
        return ''
      }

      const isInMultilineComment = line.startsWith('*')
      const isClosingBracket = line.endsWith('}')
      const isOpeningBracket = line.endsWith('{')
      const isTypeDeclaration = line.endsWith('=')
      const isTypeVariant = line.startsWith('|')

      let rightIndent = ident
      if ((isOpeningBracket || isTypeDeclaration) && !isInMultilineComment) {
        bracketDepth += 1
        rightIndent += (bracketDepth - 1) * 2
      } else {
        if (
          isClosingBracket &&
          bracketDepth > 0 &&
          !isInMultilineComment &&
          !isTypeVariant
        ) {
          bracketDepth -= 1
        }
        rightIndent += bracketDepth * 2
      }

      if (isInMultilineComment) {
        rightIndent += 1
      }

      const s = `${' '.repeat(rightIndent)}${line}`

      return s
    })
    .join('\n')

  return result
}
