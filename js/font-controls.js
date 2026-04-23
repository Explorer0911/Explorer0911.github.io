(function () {
  const STORAGE_KEY = 'blog-content-font-size'
  const DEFAULT_SIZE = 18
  const MIN_SIZE = 15
  const MAX_SIZE = 24

  const applyFontSize = size => {
    document.documentElement.style.setProperty('--content-font-size', `${size}px`)
    const valueEl = document.querySelector('.font-scale-widget__value')
    if (valueEl) valueEl.textContent = `${size}px`
  }

  const readStoredSize = () => {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const size = Number(raw)
    return Number.isFinite(size) ? Math.min(MAX_SIZE, Math.max(MIN_SIZE, size)) : DEFAULT_SIZE
  }

  const saveSize = size => {
    window.localStorage.setItem(STORAGE_KEY, String(size))
  }

  const updateSize = nextSize => {
    const size = Math.min(MAX_SIZE, Math.max(MIN_SIZE, nextSize))
    applyFontSize(size)
    saveSize(size)
  }

  const closeWidget = () => {
    const widget = document.querySelector('.font-scale-widget')
    if (widget) widget.classList.remove('is-open')
  }

  const toggleWidget = () => {
    const widget = document.querySelector('.font-scale-widget')
    if (!widget) return
    widget.classList.toggle('is-open')
  }

  const ensureWidget = () => {
    let widget = document.querySelector('.font-scale-widget')
    if (!widget) {
      widget = document.createElement('div')
      widget.className = 'font-scale-widget'
      widget.innerHTML = [
        '<span class="font-scale-widget__label">字号</span>',
        '<button class="font-scale-widget__button" type="button" data-action="decrease" aria-label="减小字体">A-</button>',
        '<button class="font-scale-widget__button" type="button" data-action="reset" aria-label="重置字体">A</button>',
        '<button class="font-scale-widget__button" type="button" data-action="increase" aria-label="增大字体">A+</button>',
        '<span class="font-scale-widget__value" aria-live="polite"></span>'
      ].join('')

      widget.addEventListener('click', event => {
        const button = event.target.closest('[data-action]')
        if (!button) return

        const current = readStoredSize()
        const action = button.getAttribute('data-action')

        if (action === 'decrease') updateSize(current - 1)
        if (action === 'increase') updateSize(current + 1)
        if (action === 'reset') updateSize(DEFAULT_SIZE)
      })

      document.body.appendChild(widget)
    }

    applyFontSize(readStoredSize())
    return widget
  }

  const ensureToggleButton = () => {
    let button = document.querySelector('#font-size-toggle')
    if (button) return button

    const host = document.querySelector('#rightside-config-hide') || document.querySelector('#rightside-config-show')
    if (!host) return null

    button = document.createElement('button')
    button.id = 'font-size-toggle'
    button.type = 'button'
    button.title = '字体大小'
    button.innerHTML = '<span>Aa</span>'
    button.addEventListener('click', event => {
      event.stopPropagation()
      toggleWidget()
    })
    host.appendChild(button)
    return button
  }

  const bindGlobalClose = () => {
    if (window.__fontScaleBound) return
    window.__fontScaleBound = true

    document.addEventListener('click', event => {
      const insideWidget = event.target.closest('.font-scale-widget')
      const onToggle = event.target.closest('#font-size-toggle')
      if (!insideWidget && !onToggle) closeWidget()
    })
  }

  const init = () => {
    applyFontSize(readStoredSize())
    ensureWidget()
    ensureToggleButton()
    bindGlobalClose()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }

  document.addEventListener('pjax:complete', init)
})()