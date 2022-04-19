import { Entity } from '../../core/Entity'
import { Checkbox } from '../controls/Checkbox'
import { Textbox } from '../controls/Textbox'
import { Editor } from './Editor'

/** Train Stop Editor */
export class TrainStopEditor extends Editor {
    public constructor(entity: Entity) {
        super(402, 171, entity)

        this.addLabel(140, 46, 'Station Name:')
        // The length is arbitrary, but the Textbox doesn't work right without it
        const stationTextBox: Textbox = new Textbox(250, entity.station, 100)
        stationTextBox.position.set(140, 65)
        this.addChild(stationTextBox)

        const isLimitDefined: boolean = this.m_Entity.manualTrainsLimit !== undefined
        const limitCheckBox: Checkbox = new Checkbox(isLimitDefined, 'Enable train limit')
        limitCheckBox.position.set(140, 97)
        this.addChild(limitCheckBox)

        const trainsLimitString: string = this.m_Entity.manualTrainsLimit?.toString()
        const limitTextbox: Textbox = new Textbox(30, trainsLimitString, 3, '0123456789')
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
