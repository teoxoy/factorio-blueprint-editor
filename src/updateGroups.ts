import factorioData from './factorio-data/factorioData'

const updateGroups = [
    {
        is: [
            'transport_belt',
            'fast_transport_belt',
            'express_transport_belt',
            'splitter',
            'fast_splitter',
            'express_splitter',
            'underground_belt',
            'fast_underground_belt',
            'express_underground_belt'
        ],
        updates: [
            'transport_belt',
            'fast_transport_belt',
            'express_transport_belt'
        ]
    },
    {
        is: [
            'heat_pipe',
            'nuclear_reactor',
            'heat_exchanger'
        ],
        updates: [
            'heat_pipe',
            'nuclear_reactor',
            'heat_exchanger'
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
            'stone_wall',
            'gate',
            'straight_rail'
        ],
        updates: [
            'stone_wall',
            'gate',
            'straight_rail'
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
