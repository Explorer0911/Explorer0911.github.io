(function () {
  const init = () => {
    if (document.querySelector('#music-card-toggle')) return
    const button = document.createElement('button')
    button.id = 'music-card-toggle'
    button.type = 'button'
    button.title = '\u97f3\u4e50\u64ad\u653e\u5668'
    button.setAttribute('aria-label', '\u6253\u5f00\u97f3\u4e50\u64ad\u653e\u5668')
    button.innerHTML = '<i class="fas fa-music" aria-hidden="true"></i><span>\u97f3\u4e50</span>'

    const load = (tag, attribute, url) => new Promise((resolve, reject) => {
      const existing = document.querySelector(`${tag}[${attribute}="${url}"]`)
      if (existing) return resolve()
      const element = document.createElement(tag)
      if (tag === 'link') element.rel = 'stylesheet'
      element[attribute] = url
      element.onload = resolve
      element.onerror = () => {
        element.remove()
        reject(new Error(`Unable to load ${url}`))
      }
      document.head.appendChild(element)
    })

    const openPlayer = async event => {
      event.stopImmediatePropagation()
      button.disabled = true
      button.setAttribute('aria-busy', 'true')
      button.title = '\u6b63\u5728\u52a0\u8f7d\u97f3\u4e50\u64ad\u653e\u5668'
      try {
        await load('link', 'href', '/css/music-card.css')
        await load('script', 'src', '/js/music-card.js')
        button.removeEventListener('click', openPlayer)
        button.disabled = false
        button.title = '\u97f3\u4e50\u64ad\u653e\u5668'
        button.click()
      } catch (error) {
        button.title = '\u52a0\u8f7d\u5931\u8d25\uff0c\u70b9\u51fb\u91cd\u8bd5'
        console.warn(error.message)
      } finally {
        button.disabled = false
        button.removeAttribute('aria-busy')
      }
    }
    button.addEventListener('click', openPlayer)
    document.body.appendChild(button)
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init)
  else init()
  document.addEventListener('pjax:complete', init)
})()
