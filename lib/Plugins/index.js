"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

/**
 * Plugin and Middleware Manager for WaSockets
 * Enables modular extensions, event interception, and pipeline middleware.
 */
class PluginManager {
    constructor(sock) {
        this.sock = sock
        this.plugins = new Map()
        this.middlewares = {
            beforeSendMessage: [],
            afterSendMessage: [],
            beforeRecvMessage: [],
            afterRecvMessage: [],
            connectionUpdate: []
        }
    }

    /**
     * Install a plugin
     * @param {Object|Function} plugin - Plugin object with install() or function (sock, options)
     * @param {Object} [options={}] - Options passed to plugin
     */
    use(plugin, options = {}) {
        if (!plugin) return this

        if (typeof plugin === 'function') {
            plugin(this.sock, options, this)
            return this
        }

        const name = plugin.name || `plugin_${this.plugins.size + 1}`
        if (this.plugins.has(name)) {
            throw new Error(`Plugin with name "${name}" is already registered`)
        }

        this.plugins.set(name, {
            plugin,
            options,
            registeredAt: Date.now()
        })

        if (typeof plugin.install === 'function') {
            plugin.install(this.sock, options, this)
        }

        return this
    }

    /**
     * Register a middleware hook
     * @param {'beforeSendMessage'|'afterSendMessage'|'beforeRecvMessage'|'afterRecvMessage'|'connectionUpdate'} hook
     * @param {Function} fn - Async middleware function
     * @returns {Function} Unregister function
     */
    registerMiddleware(hook, fn) {
        if (!this.middlewares[hook]) {
            this.middlewares[hook] = []
        }
        this.middlewares[hook].push(fn)
        return () => {
            this.middlewares[hook] = this.middlewares[hook].filter(f => f !== fn)
        }
    }

    /**
     * Execute all middlewares for a specific hook
     * @param {string} hook
     * @param {Object} context
     * @returns {Promise<boolean>} returns false if any middleware explicitly returned false (cancelled)
     */
    async runMiddlewares(hook, context) {
        const hooks = this.middlewares[hook] || []
        for (const fn of hooks) {
            try {
                const result = await fn(context, this.sock)
                if (result === false) {
                    return false
                }
            } catch (error) {
                if (this.sock.logger) {
                    this.sock.logger.error({ error, hook }, 'Error executing plugin middleware')
                } else {
                    console.error(`[PluginManager] Error executing middleware on hook ${hook}:`, error)
                }
            }
        }
        return true
    }

    /**
     * Check if a plugin is installed
     * @param {string} name
     */
    hasPlugin(name) {
        return this.plugins.has(name)
    }

    /**
     * Retrieve an installed plugin
     * @param {string} name
     */
    getPlugin(name) {
        return this.plugins.get(name)
    }

    /**
     * List all installed plugins
     */
    listPlugins() {
        return Array.from(this.plugins.entries()).map(([name, data]) => ({
            name,
            registeredAt: data.registeredAt,
            version: data.plugin?.version || '1.0.0',
            description: data.plugin?.description || ''
        }))
    }
}

module.exports = {
    PluginManager
}
