import Entity from '../factorio-data/entity'
import Switch from '../controls/switch'
import Enable from '../controls/enable'
import Editor from './editor'

/** Inserter Editor */
export default class InserterEditor extends Editor {
    constructor(entity: Entity) {
        super(446, 171, entity)

        if (this.m_Entity.filterSlots > 0) {
            const filterMode = this.m_Entity.filterMode

            const filterModeWhitelist = new Enable(filterMode === 'whitelist', 'Whitelist')
            filterModeWhitelist.position.set(140, 45)
            this.addChild(filterModeWhitelist)

            const filterModeSwitch = new Switch(['whitelist', 'blacklist'], filterMode)
            filterModeSwitch.position.set(210, 45)
            this.addChild(filterModeSwitch)

            const filterModeBlacklist = new Enable(filterMode === 'blacklist', 'Blacklist')
            filterModeBlacklist.position.set(260, 45)
            this.addChild(filterModeBlacklist)

            // Add Filters
            this.addLabel(140, 56 + 25, `Filter${this.m_Entity.filterSlots === 1 ? '' : 's'}:`)
            this.addFilters(208, 70)

            // Events
            filterModeWhitelist.on('changed', () => {
                this.m_Entity.filterMode = filterModeWhitelist.active ? 'whitelist' : 'blacklist'
            })

            filterModeSwitch.on('changed', () => {
                this.m_Entity.filterMode = filterModeSwitch.value as 'whitelist' | 'blacklist'
            })

            filterModeBlacklist.on('changed', () => {
                this.m_Entity.filterMode = filterModeBlacklist.active ? 'blacklist' : 'whitelist'
            })

            this.m_Entity.on('filterMode', filterMode => {
                filterModeSwitch.value = filterMode
                filterModeWhitelist.active = filterMode === 'whitelist'
                filterModeBlacklist.active = filterMode === 'blacklist'
            })
        }
    }
}
