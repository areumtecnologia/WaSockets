"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { BaseStorageAdapter } = require("./BaseStorageAdapter")
const { MemoryStorageAdapter } = require("./MemoryStorageAdapter")
const { FileStorageAdapter } = require("./FileStorageAdapter")

exports.BaseStorageAdapter = BaseStorageAdapter
exports.MemoryStorageAdapter = MemoryStorageAdapter
exports.FileStorageAdapter = FileStorageAdapter
