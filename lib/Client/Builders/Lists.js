"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

/**
 * Individual row in an interactive list section
 */
class ListRow {
    constructor(title, description = '', rowId = '', header = '') {
        this.title = title || ''
        this.description = description || ''
        this.rowId = rowId || title || 'row'
        this.id = this.rowId
        this.header = header || ''
    }

    withHeader(header) {
        this.header = header || ''
        return this
    }

    build() {
        return {
            id: this.rowId,
            rowId: this.rowId,
            title: this.title,
            description: this.description,
            ...(this.header ? { header: this.header } : {})
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
        this.highlightLabel = ''
    }

    withHighlightLabel(label) {
        this.highlightLabel = label || ''
        return this
    }

    addRow(titleOrRow, description, rowId, header) {
        if (titleOrRow instanceof ListRow) {
            this.rows.push(titleOrRow)
        } else {
            this.rows.push(new ListRow(titleOrRow, description, rowId, header))
        }
        return this
    }

    build() {
        return {
            title: this.title,
            ...(this.highlightLabel ? { highlight_label: this.highlightLabel } : {}),
            rows: this.rows.map(row => typeof row.build === 'function' ? row.build() : {
                id: row.id || row.rowId,
                rowId: row.rowId || row.id,
                title: row.title,
                description: row.description,
                ...(row.header ? { header: row.header } : {})
            })
        }
    }
}

/**
 * List Dropdown Button configuration (Native Flow single_select)
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
        const builtSections = this.sections.map(sec => typeof sec.build === 'function' ? sec.build() : sec)
        return {
            name: "single_select",
            buttonParamsJson: JSON.stringify({
                title: this.buttonText,
                sections: builtSections
            }),
            buttonText: this.buttonText,
            sections: builtSections
        }
    }
}

exports.ListRow = ListRow
exports.ListSection = ListSection
exports.ListButton = ListButton
