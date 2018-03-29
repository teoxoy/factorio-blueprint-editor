import factorioData from './factorio-data/factorioData'

const updateGroups = [
    {
        is: [
            'transport-belt',
            'fast-transport-belt',
            'express-transport-belt',
            'splitter',
            'fast-splitter',
            'express-splitter',
            'underground-belt',
            'fast-underground-belt',
            'express-underground-belt'
        ],
        updates: [
            'transport-belt',
            'fast-transport-belt',
            'express-transport-belt'
        ]
    },
    {
        is: [
            'heat-pipe',
            'nuclear-reactor',
            'heat-exchanger'
        ],
        updates: [
            'heat-pipe',
            'nuclear-reactor',
            'heat-exchanger'
        ]
    },
    {
        has: [
            'fluid_box',
            'output_fluid_box',
            'fluid_boxes'
        ],
        updates: [
            'fluid_box',
            'output_fluid_box',
            'fluid_boxes'
        ]
    },
    {
        is: [
            'stone-wall',
            'gate',
            'straight-rail'
        ],
        updates: [
            'stone-wall',
            'gate',
            'straight-rail'
        ]
    }
]

for (const updateGroup of updateGroups) {
    if (updateGroup.has) {
        const is = []
        const updates = []
        for (let j = 0; j < updateGroup.has.length; j++) {
            const ed = factorioData.getEntities()
            for (const k in ed) {
                if (ed[k][updateGroup.has[j]]) {
                    is.push(k)
                }
            }
            for (const k in ed) {
                if (ed[k][updateGroup.updates[j]]) {
                    updates.push(k)
                }
            }
        }

        delete updateGroup.has
        updateGroup.is = is
        updateGroup.updates = updates
    }
}

export {
    updateGroups
}
