import { WASocket } from '../index'

export interface PluginMetadata {
    name: string
    version?: string
    description?: string
    author?: string
    install?: (sock: WASocket, options?: any, manager?: PluginManager) => void
}

export type PluginFunction = (sock: WASocket, options?: any, manager?: PluginManager) => void
export type Plugin = PluginMetadata | PluginFunction

export type MiddlewareHook =
    | 'beforeSendMessage'
    | 'afterSendMessage'
    | 'beforeRecvMessage'
    | 'afterRecvMessage'
    | 'connectionUpdate'

export declare class PluginManager {
    constructor(sock: WASocket)
    sock: WASocket
    plugins: Map<string, any>
    middlewares: Record<string, Function[]>

    use(plugin: Plugin, options?: any): this
    registerMiddleware(hook: MiddlewareHook, fn: (context: any, sock: WASocket) => Promise<boolean | void> | boolean | void): () => void
    runMiddlewares(hook: string, context: any): Promise<boolean>
    hasPlugin(name: string): boolean
    getPlugin(name: string): any
    listPlugins(): Array<{ name: string; registeredAt: number; version: string; description: string }>
}
