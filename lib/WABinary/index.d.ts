export interface BinaryNodeAttributes {
    [key: string]: string | undefined
}

export interface BinaryNode {
    tag: string
    attrs: BinaryNodeAttributes
    content?: BinaryNode[] | string | Uint8Array
}

export declare function jidEncode(user: string | null | undefined, server: string, device?: number, agent?: number): string
export declare function encodeBinaryNode(node: BinaryNode): Uint8Array
export declare function decodeBinaryNode(data: Uint8Array): BinaryNode
export declare const S_WHATSAPP_NET: string
export declare const STORIES_JID: string
export declare const OFFICIAL_BIZ_JID: string
export declare const SERVER_JID: string
