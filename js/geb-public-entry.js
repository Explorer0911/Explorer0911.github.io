(() => {
  'use strict'

  const targetPaths = new Set([
    '/categories/%E5%87%A0%E4%BD%95%E7%B2%BE%E7%A1%AE%E6%A2%81/',
    '/tags/GEB/'
  ])

  const rewrite = () => {
    document.querySelectorAll('a[href]').forEach(anchor => {
      let url
      try {
        url = new URL(anchor.getAttribute('href'), window.location.origin)
      } catch (error) {
        return
      }

      if (targetPaths.has(url.pathname)) {
        anchor.setAttribute('href', '/geb/')
        anchor.dataset.gebPortalLink = 'true'
      }
    })
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', rewrite)
  else rewrite()
  window.addEventListener('hexo-blog-decrypt', () => window.setTimeout(rewrite, 0))
})()
