/// <reference types="node" />

import { AuthenticationState, WAMessage, AnyMessageContent, MiscMessageGenerationOptions } from '../Types'
import { proto } from '../../WAProto'

export declare function useMultiFileAuthState(folder: string): Promise<{
    state: AuthenticationState
    saveCreds: () => Promise<void>
}>

export declare function shouldReconnect(error: any): boolean

export declare const Browsers: {
    ubuntu(browser: string): [string, string, string]
    macOS(browser: string): [string, string, string]
    baileys(browser: string): [string, string, string]
    windows(browser: string): [string, string, string]
    appropriate(browser: string): [string, string, string]
}

export declare function delay(ms: number): Promise<void>
export declare function downloadMediaMessage(message: WAMessage, type: 'buffer' | 'stream', options: any, ctx?: any): Promise<Buffer | any>
export declare function generateWAMessageFromContent(jid: string, message: proto.IMessage, options: MiscMessageGenerationOptions): any
export declare function generateWAMessage(jid: string, content: AnyMessageContent, options: MiscMessageGenerationOptions): Promise<WAMessage>
export declare function jidDecode(jid: string): { user: string; server: string; device?: number } | undefined
export declare function jidNormalizedUser(jid: string): string
export declare function areJidsSameUser(jid1: string | undefined, jid2: string | undefined): boolean
export declare function isJidGroup(jid: string | undefined): boolean
export declare function isJidBroadcast(jid: string | undefined): boolean
export declare function isJidUser(jid: string | undefined): boolean
export declare function isJidNewsletter(jid: string | undefined): boolean
export declare function isJidStatusBroadcast(jid: string | undefined): boolean
export declare function fetchLatestWaWebVersion(options?: any): Promise<{ version: [number, number, number]; isLatest: boolean }>
