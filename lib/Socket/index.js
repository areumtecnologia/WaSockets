"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { DEFAULT_CONNECTION_CONFIG, createGroupMetadataCache } = require("../Defaults/connection")
const { makeCommunitiesSocket } = require("./community")
const { PluginManager } = require("../Plugins")

// export the last socket layer
const makeWASocket = (config = {}) => {
	const newConfig = {
    	...DEFAULT_CONNECTION_CONFIG,
   	 ...config
    }
    
    // If the user hasn't provided their own history sync function,
    // let's create a default one that respects the syncFullHistory flag.
    if (config.shouldSyncHistoryMessage === undefined) {
        newConfig.shouldSyncHistoryMessage = () => !!newConfig.syncFullHistory
    }

    if (!config.cachedGroupMetadata && newConfig.enableGroupCache) {
        newConfig.cachedGroupMetadata = createGroupMetadataCache()
    }

    const sock = makeCommunitiesSocket(newConfig)
    const pluginManager = new PluginManager(sock)

    sock.plugins = pluginManager
    sock.use = (plugin, options) => {
        pluginManager.use(plugin, options)
        return sock
    }
    sock.registerMiddleware = (hook, fn) => pluginManager.registerMiddleware(hook, fn)
    sock.hasPlugin = (name) => pluginManager.hasPlugin(name)
    sock.listPlugins = () => pluginManager.listPlugins()

    // Auto-install plugins passed in configuration
    if (Array.isArray(config.plugins)) {
        for (const p of config.plugins) {
            sock.use(p)
        }
    }

    return sock
}

exports.default = makeWASocket