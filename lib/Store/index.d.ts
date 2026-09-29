import { InMemoryStore, InMemoryStoreConfig } from '../index'

export declare function makeInMemoryStore(config?: InMemoryStoreConfig): InMemoryStore
export declare function makeCacheManagerAuthState(store: any, sessionKey: string): Promise<any>
