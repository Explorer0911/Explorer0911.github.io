(function () {
  const isAbsoluteUrl = value => /^https?:\/\//i.test(String(value || ''))

  const resolvePublicUrl = value => {
    const text = String(value || '').trim()
    if (!text) return ''
    if (isAbsoluteUrl(text)) return text

    try {
      return new URL(text, window.location.origin).toString()
    } catch (error) {
      return text
    }
  }

  const initWatchingHome = root => {
    if (!root || root.dataset.enhanced === 'true') return
    root.dataset.enhanced = 'true'

    const searchInput = root.querySelector('[data-watching-search]')
    const searchPanel = root.querySelector('[data-watch-search-panel]')
    const searchToggle = root.querySelector('[data-watch-search-toggle]')
    const filtersNode = root.querySelector('[data-watching-filters]')
    const emptyState = root.querySelector('[data-watching-empty]')
    const blankState = root.querySelector('[data-watching-blank]')
    const countNode = root.querySelector('[data-watch-count]')
    const entryNodes = Array.from(root.querySelectorAll('[data-watch-entry]'))

    let activeFilter = 'all'

    if (!entryNodes.length) {
      if (blankState) blankState.hidden = false
      if (emptyState) emptyState.hidden = true
      if (countNode) countNode.textContent = '0'
      return
    }

    const updateCount = visibleCount => {
      if (countNode) countNode.textContent = String(visibleCount)
      if (emptyState) emptyState.hidden = visibleCount !== 0
      if (blankState) blankState.hidden = true
    }

    const applyFilters = () => {
      const keyword = (searchInput && searchInput.value ? searchInput.value : '').trim().toLowerCase()
      let visibleCount = 0

      entryNodes.forEach(entry => {
        const text = (entry.dataset.search || '').toLowerCase()
        const filterLabel = entry.dataset.filter || ''
        const matchedFilter = activeFilter === 'all' || filterLabel === activeFilter
        const matchedKeyword = !keyword || text.indexOf(keyword) > -1
        const matched = matchedFilter && matchedKeyword

        entry.classList.toggle('is-hidden', !matched)
        if (matched) visibleCount += 1
      })

      updateCount(visibleCount)
    }

    const toggleSearch = forceOpen => {
      if (!searchPanel || !searchToggle || !searchInput) return

      const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : searchPanel.hidden
      searchPanel.hidden = !shouldOpen
      searchToggle.classList.toggle('is-active', shouldOpen)

      if (shouldOpen) {
        searchInput.focus()
      } else {
        if (searchInput.value) {
          searchInput.value = ''
          applyFilters()
        }
      }
    }

    if (searchInput) {
      searchInput.addEventListener('input', applyFilters)
      searchInput.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
          toggleSearch(false)
        }
      })
    }

    if (searchToggle) {
      searchToggle.addEventListener('click', () => {
        toggleSearch()
      })
    }

    if (filtersNode) {
      filtersNode.addEventListener('click', event => {
        const button = event.target.closest('[data-filter]')
        if (!button) return

        activeFilter = button.getAttribute('data-filter') || 'all'
        filtersNode.querySelectorAll('[data-filter]').forEach(node => {
          node.classList.toggle('is-active', node === button)
        })
        applyFilters()
      })
    }

    applyFilters()
  }

  const initWatchingDetail = root => {
    if (!root || root.dataset.enhanced === 'true') return
    root.dataset.enhanced = 'true'

    root.addEventListener('click', async event => {
      const button = event.target.closest('[data-copy]')
      if (!button) return

      const rawValue = button.getAttribute('data-copy') || ''
      const value = resolvePublicUrl(rawValue)
      if (!value) return

      const originalText = button.textContent

      try {
        await navigator.clipboard.writeText(value)
        button.textContent = '已复制'
      } catch (error) {
        button.textContent = '复制失败'
      }

      window.setTimeout(() => {
        button.textContent = originalText
      }, 1600)
    })

    root.querySelectorAll('.watch-entry__qr-image[data-qr-target]').forEach(image => {
      const rawTarget = image.getAttribute('data-qr-target')
      const target = resolvePublicUrl(rawTarget)
      if (!target) return
      image.src = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent(target)
    })
  }

  const initWatching = () => {
    document.querySelectorAll('[data-watching-home]').forEach(initWatchingHome)
    document.querySelectorAll('[data-watching-detail]').forEach(initWatchingDetail)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWatching)
  } else {
    initWatching()
  }

  document.addEventListener('pjax:complete', initWatching)
})()
