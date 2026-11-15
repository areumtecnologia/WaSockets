"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

/**
 * Individual row in an interactive list section
 */
class ListRow {
    constructor(title, description = '', rowId = '') {
        this.title = title || ''
        this.description = description || ''
        this.rowId = rowId || title || 'row'
    }

    build() {
        return {
            title: this.title,
            description: this.description,
            rowId: this.rowId
        }
    }
}

/**
 * Categorized section containing multiple rows
 */
class ListSection {
    constructor(title, rows = []) {
        this.title = title || ''
        this.rows = Array.isArray(rows) ? rows : []
    }

    addRow(titleOrRow, description, rowId) {
        if (titleOrRow instanceof ListRow) {
            this.rows.push(titleOrRow)
        } else {
            this.rows.push(new ListRow(titleOrRow, description, rowId))
        }
        return this
    }

    build() {
        return {
            title: this.title,
            rows: this.rows.map(row => typeof row.build === 'function' ? row.build() : row)
        }
    }
}

/**
 * List Dropdown Button configuration
 */
class ListButton {
    constructor(buttonText, sections = []) {
        this.buttonText = buttonText || 'Ver Opções'
        this.sections = Array.isArray(sections) ? sections : []
    }

    addSection(titleOrSection, rows) {
        if (titleOrSection instanceof ListSection) {
            this.sections.push(titleOrSection)
        } else {
            this.sections.push(new ListSection(titleOrSection, rows))
        }
        return this
    }

    build() {
        return {
            buttonText: this.buttonText,
            sections: this.sections.map(sec => typeof sec.build === 'function' ? sec.build() : sec)
        }
    }
}

exports.ListRow = ListRow
exports.ListSection = ListSection
exports.ListButton = ListButton
