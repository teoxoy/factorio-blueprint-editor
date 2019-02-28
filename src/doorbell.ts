export default function initDoorbell() {
    window.doorbellOptions = {
        id: '9657',
        appKey: 'z1scfSY8hpBNiIFWxBg50tkhjvFKhHMdhfGNMp6YCUZVttoLOqtrlhk4ca9asDCy',
        windowLoaded: true,
        onInitialized: () => {
            let activeTag: HTMLElement
            const tagsDiv = document.createElement('div')
            tagsDiv.id = 'doorbell-tags'
            const tags = [
                { name: 'Other', color: '#757575' },
                { name: 'Bug', color: '#e53935' },
                { name: 'Enhancement', color: '#00ACC1' },
                { name: 'Feature Request', color: '#FFB300' }
            ]
            tags.forEach((tag, i) => {
                const tagEl = document.createElement('div')
                tagEl.innerHTML = tag.name
                tagEl.style.backgroundColor = tag.color
                tagEl.onclick = () => {
                    activeTag.classList.remove('active')
                    activeTag = tagEl
                    tagEl.classList.add('active')
                    window.doorbellOptions.tags = tag.name
                }
                if (i === 0) {
                    activeTag = tagEl
                    tagEl.classList.add('active')
                    window.doorbellOptions.tags = tag.name
                }
                tagsDiv.appendChild(tagEl)
            })

            const fieldset = document.getElementById('doorbell-form').firstElementChild
            fieldset.insertBefore(tagsDiv, fieldset.lastElementChild)
        }
    }

    document.body.appendChild(
        Object.assign(document.createElement('script'), {
            id: 'doorbellScript',
            type: 'text/javascript',
            async: true,
            src: `https://embed.doorbell.io/button/${window.doorbellOptions.id}?t=${Date.now()}`
        })
    )
}
