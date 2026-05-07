import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { STORYCLAW_PERSONA } from '@/agent/persona'

const DB_NAME = 'storyclaw'
const DB_VERSION = 8

export interface StoryClawDBSchema extends DBSchema {
  novels: {
    key: string
    value: import('./types').Novel
  }
  outlines: {
    key: string
    value: import('./types').Outline
  }
  characters: {
    key: [string, string]
    value: import('./types').Character
    indexes: { novelId: string }
  }
  chapters: {
    key: [string, number]
    value: import('./types').Chapter
    indexes: { novelId: string }
  }
  worldBuilding: {
    key: string
    value: import('./types').WorldBuilding
  }
  conversations: {
    key: string
    value: import('./types').Conversation
  }
  contextSnapshots: {
    key: string
    value: import('./types').ContextSnapshot
    indexes: {
      novelId: string
      scopeId: string
      novelScopeRevision: [string, string, number]
      createdAt: number
    }
  }
  config: {
    key: string
    value: import('./types').AppConfig
  }
  readingProgress: {
    key: string
    value: import('./types').ReadingProgress
  }
  operationHistory: {
    key: string
    value: import('./types').OperationRecord
    indexes: { novelId: string }
  }
  prompts: {
    key: string
    value: import('./types').Prompt
  }
  assets: {
    key: string
    value: import('./types').BackgroundImage
  }
  roleplaySessions: {
    key: string
    value: import('./roleplay-types').RoleplaySession
  }
  roleplayConversations: {
    key: string
    value: import('./roleplay-types').RoleplayConversation
  }
}

let dbInstance: IDBPDatabase<StoryClawDBSchema> | null = null

export async function getDB(): Promise<IDBPDatabase<StoryClawDBSchema>> {
  if (dbInstance) return dbInstance

  dbInstance = await openDB<StoryClawDBSchema>(DB_NAME, DB_VERSION, {
    async upgrade(db, oldVersion) {
      if (!db.objectStoreNames.contains('novels')) {
        db.createObjectStore('novels', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('outlines')) {
        db.createObjectStore('outlines', { keyPath: 'novelId' })
      }
      if (!db.objectStoreNames.contains('characters')) {
        const cs = db.createObjectStore('characters', { keyPath: ['novelId', 'id'] })
        cs.createIndex('novelId', 'novelId')
      }
      if (!db.objectStoreNames.contains('chapters')) {
        const cs = db.createObjectStore('chapters', { keyPath: ['novelId', 'index'] })
        cs.createIndex('novelId', 'novelId')
      }
      if (!db.objectStoreNames.contains('worldBuilding')) {
        db.createObjectStore('worldBuilding', { keyPath: 'novelId' })
      }
      if (!db.objectStoreNames.contains('conversations')) {
        db.createObjectStore('conversations', { keyPath: 'novelId' })
      }
      if (!db.objectStoreNames.contains('contextSnapshots')) {
        const ss = db.createObjectStore('contextSnapshots', { keyPath: 'id' })
        ss.createIndex('novelId', 'novelId')
        ss.createIndex('scopeId', 'scopeId')
        ss.createIndex('novelScopeRevision', ['novelId', 'scopeId', 'revision'])
        ss.createIndex('createdAt', 'createdAt')
      }
      if (!db.objectStoreNames.contains('config')) {
        db.createObjectStore('config', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('readingProgress')) {
        db.createObjectStore('readingProgress', { keyPath: 'novelId' })
      }
      if (!db.objectStoreNames.contains('operationHistory')) {
        db.createObjectStore('operationHistory', { keyPath: 'id' }).createIndex(
          'novelId',
          'novelId',
        )
      }

      if (oldVersion < 3 && db.objectStoreNames.contains('conversations')) {
        db.deleteObjectStore('conversations')
        db.createObjectStore('conversations', { keyPath: 'novelId' })
      }

      if (!db.objectStoreNames.contains('prompts')) {
        const store = db.createObjectStore('prompts', { keyPath: 'id' })
        await store.put({
          id: 'builtin-persona',
          name: 'StoryClaw 默认风格',
          content: STORYCLAW_PERSONA,
          isBuiltin: true,
          createdAt: 0,
          updatedAt: 0,
        })
      }

      if (!db.objectStoreNames.contains('assets')) {
        db.createObjectStore('assets', { keyPath: 'id' })
      }

      if (oldVersion < 7) {
        if (!db.objectStoreNames.contains('roleplaySessions')) {
          db.createObjectStore('roleplaySessions', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('roleplayConversations')) {
          db.createObjectStore('roleplayConversations', { keyPath: 'sessionId' })
        }
      }

      if (oldVersion < 8) {
        // v7 upgrade may have failed due to illegal db.transaction() call.
        // v8 ensures stores exist even if v7 was skipped.
        if (!db.objectStoreNames.contains('roleplaySessions')) {
          db.createObjectStore('roleplaySessions', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('roleplayConversations')) {
          db.createObjectStore('roleplayConversations', { keyPath: 'sessionId' })
        }
      }
    },
  })

  return dbInstance
}
