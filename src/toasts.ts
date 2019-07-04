interface IToastsOptions {
    text: string
    type?: 'success' | 'info' | 'warning' | 'error'
    timeout?: number
}

function initToasts() {
    let autoincrement = 0
    const getNextID = () => {
        autoincrement += 1
        return `toast-${autoincrement}`
    }

    const container = document.createElement('div')
    container.className = 'toasts-container'
    document.body.appendChild(container)

    return (options: IToastsOptions) => {
        const toast = document.createElement('div')
        toast.id = getNextID()
        toast.className = 'toasts-toast'

        const text = document.createElement('span')
        text.className = 'toasts-text'
        text.innerHTML = options.text
        toast.appendChild(text)

        toast.classList.add(`toasts-${options.type || 'info'}`)

        toast.addEventListener(
            'animationend',
            () => {
                toast.style.maxHeight = `${toast.offsetHeight}px`
            },
            { once: true }
        )

        Promise.race([
            new Promise(resolve => setTimeout(resolve, options.timeout || 5000)),
            new Promise(resolve => toast.addEventListener('click', resolve, { once: true }))
        ]).then(() => {
            toast.classList.add('toasts-toast-fadeOut')
            toast.addEventListener(
                'transitionend',
                () => {
                    container.removeChild(toast)
                },
                { once: true }
            )
        })

        container.prepend(toast)
    }
}

export default initToasts
