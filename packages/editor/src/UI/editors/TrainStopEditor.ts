import { Entity } from '../../core/Entity'
import { Checkbox } from '../controls/Checkbox'
import { TextInput } from '../controls/TextInput'
import { Editor } from './Editor'
import G from '../../common/globals'

/** Train Stop Editor */
export class TrainStopEditor extends Editor {
    public constructor(entity: Entity) {
        super(402, 171, entity)

        this.addLabel(140, 46, 'Station Name:')
        // The length is arbitrary, but the Textbox doesn't work right without it
        const stationTextBox = new TextInput(G.app.renderer, 250, entity.station, 100)
        stationTextBox.position.set(140, 65)
        this.addChild(stationTextBox)

        const isLimitDefined = this.m_Entity.manualTrainsLimit !== undefined
        const limitCheckBox = new Checkbox(isLimitDefined, 'Enable train limit')
        limitCheckBox.position.set(140, 97)
        this.addChild(limitCheckBox)

        const trainsLimitString =
            this.m_Entity.manualTrainsLimit === undefined
                ? ''
                : this.m_Entity.manualTrainsLimit.toString()
        const limitTextbox = new TextInput(G.app.renderer, 30, trainsLimitString, 3, true)
        limitTextbox.position.set(275, 95)
        this.addChild(limitTextbox)

        stationTextBox.on('changed', () => {
            this.m_Entity.station = stationTextBox.text
        })

        limitCheckBox.on('changed', () => {
            if (limitCheckBox.checked) {
                this.m_Entity.manualTrainsLimit = 0
                limitTextbox.text = '0'
            } else {
                this.m_Entity.manualTrainsLimit = undefined
                limitTextbox.text = ''
            }
        })

        limitTextbox.on('changed', () => {
            let limit: number = parseInt(limitTextbox.text)
            if (isNaN(limit)) {
                limit = undefined
            }

            this.m_Entity.manualTrainsLimit = limit
            limitCheckBox.checked = limit !== undefined && limit >= 0
        })

        this.onEntityChange('station', () => {
            stationTextBox.text = this.m_Entity.station
        })

        this.onEntityChange('manualTrainsLimit', () => {
            const limit = this.m_Entity.manualTrainsLimit
            limitTextbox.text = limit === undefined ? '' : `${limit}`
            limitCheckBox.checked = limit !== undefined && limit >= 0
        })
    }
}
