(function () {
  'use strict'

  const SVG_NS = 'http://www.w3.org/2000/svg'
  const NODE_WIDTH = 212
  const NODE_HEIGHT = 48
  const X_GAP = 76
  const Y_GAP = 22
  const PAD_X = 30
  const PAD_Y = 32

  const createSvg = tag => document.createElementNS(SVG_NS, tag)

  const sortChildren = children => (children || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0))

  const initKnowledgeMap = root => {
    if (!root || root.dataset.enhanced === 'true') return

    const dataNode = root.parentElement
      ? root.parentElement.querySelector('script[data-geb-knowledge-map-data]')
      : document.querySelector('script[data-geb-knowledge-map-data]')

    if (!dataNode) return

    let payload
    try {
      payload = JSON.parse(dataNode.textContent || '{}')
    } catch (error) {
      root.innerHTML = '<p class="geb-km-error">知识导览数据读取失败。</p>'
      return
    }

    if (!payload || !payload.knowledgeTree || !payload.routes) return

    root.dataset.enhanced = 'true'

    const tree = payload.knowledgeTree
    const routes = payload.routes
    const nodeById = new Map()
    const parentById = new Map()
    const initialExpanded = new Set()

    const indexTree = (node, parent) => {
      nodeById.set(node.id, node)
      if (parent) parentById.set(node.id, parent.id)
      if (node.defaultExpanded) initialExpanded.add(node.id)
      sortChildren(node.children).forEach(child => indexTree(child, node))
    }

    indexTree(tree, null)

    const articleRoot = document.getElementById('article-container') || document
    const titleToHref = new Map()
    articleRoot.querySelectorAll('a[href]').forEach(anchor => {
      const title = (anchor.textContent || '').replace(/\s+/g, ' ').trim()
      if (title && !titleToHref.has(title)) titleToHref.set(title, anchor.href)
    })

    const resolveHref = node => {
      if (node.url) return node.url
      if (node.title && titleToHref.has(node.title)) return titleToHref.get(node.title)
      return ''
    }

    root.innerHTML = [
      '<section class="geb-km-shell">',
      '  <div class="geb-km-head">',
      '    <div>',
      '      <div class="geb-km-title">GEB 知识导览</div>',
      '      <div class="geb-km-subtitle">点击 Part 或章节展开，点击文章进入正文。</div>',
      '    </div>',
      '    <div class="geb-km-routes" data-geb-km-routes></div>',
      '  </div>',
      '  <div class="geb-km-body">',
      '    <div class="geb-km-canvas" data-geb-km-canvas><svg class="geb-km-svg" data-geb-km-svg role="img" aria-label="GEB 知识结构图"></svg></div>',
      '    <aside class="geb-km-info" data-geb-km-info aria-live="polite"></aside>',
      '  </div>',
      '</section>'
    ].join('')

    const routesNode = root.querySelector('[data-geb-km-routes]')
    const canvas = root.querySelector('[data-geb-km-canvas]')
    const svg = root.querySelector('[data-geb-km-svg]')
    const info = root.querySelector('[data-geb-km-info]')

    let expanded = new Set(initialExpanded)
    let activeRoute = ''
    let selectedId = tree.id

    const routeOrder = ['theory', 'numerical', 'drill', 'validation']

    const expandActiveRoute = routeId => {
      expanded = new Set(initialExpanded)

      if (!routeId || !routes[routeId]) return

      ;(routes[routeId].path || []).forEach(targetId => {
        let parentId = parentById.get(targetId)
        while (parentId) {
          expanded.add(parentId)
          parentId = parentById.get(parentId)
        }
      })
    }

    const sidebarRouteNav = (() => {
      const tocCard = document.getElementById('card-toc')
      if (!tocCard) return null

      const previous = tocCard.querySelector('[data-geb-map-route-nav]')
      if (previous) previous.remove()

      const nav = document.createElement('div')
      nav.className = 'geb-map-route-nav'
      nav.dataset.gebMapRouteNav = ''
      nav.innerHTML = [
        '<div class="geb-map-route-nav__head">',
        '  <span>当前路线</span>',
        '  <button type="button" class="geb-map-route-nav__reset" data-route="">全部</button>',
        '</div>',
        '<div class="geb-map-route-nav__list" data-geb-map-route-list></div>'
      ].join('')
      tocCard.appendChild(nav)
      return nav
    })()

    const renderSidebarRoutes = () => {
      if (!sidebarRouteNav) return

      const list = sidebarRouteNav.querySelector('[data-geb-map-route-list]')
      const reset = sidebarRouteNav.querySelector('.geb-map-route-nav__reset')
      if (!list || !reset) return

      reset.classList.toggle('is-active', activeRoute === '')
      reset.setAttribute('aria-pressed', activeRoute === '' ? 'true' : 'false')
      list.innerHTML = ''

      routeOrder.forEach(id => {
        if (!routes[id]) return
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'geb-map-route-nav__button'
        button.dataset.route = id
        button.textContent = routes[id].title
        button.classList.toggle('is-active', activeRoute === id)
        button.setAttribute('aria-pressed', activeRoute === id ? 'true' : 'false')
        list.appendChild(button)
      })
    }

    const setActiveRoute = routeId => {
      activeRoute = routeId && routes[routeId] ? routeId : ''
      expandActiveRoute(activeRoute)
      selectedId = activeRoute && routes[activeRoute] && routes[activeRoute].start
        ? routes[activeRoute].start
        : tree.id

      renderRouteButtons()
      renderSidebarRoutes()
      render()
    }

    const renderRouteButtons = () => {
      routesNode.innerHTML = ''

      const addButton = (id, label) => {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'geb-km-route'
        button.dataset.route = id
        button.textContent = label
        button.classList.toggle('is-active', activeRoute === id)
        button.setAttribute('aria-pressed', activeRoute === id ? 'true' : 'false')
        button.addEventListener('click', () => setActiveRoute(id))
        routesNode.appendChild(button)
      }

      addButton('', '全部')
      routeOrder.forEach(id => {
        if (routes[id]) addButton(id, routes[id].title)
      })
    }

    if (sidebarRouteNav) {
      sidebarRouteNav.addEventListener('click', event => {
        const button = event.target.closest('button[data-route]')
        if (!button || !sidebarRouteNav.contains(button)) return
        setActiveRoute(button.dataset.route || '')
      })
    }

    const getRouteSet = () => {
      if (!activeRoute || !routes[activeRoute]) return null
      const set = new Set(routes[activeRoute].path || [])

      nodeById.forEach(node => {
        if ((node.routes || []).includes(activeRoute)) set.add(node.id)
      })

      Array.from(set).forEach(id => {
        let parentId = parentById.get(id)
        while (parentId) {
          set.add(parentId)
          parentId = parentById.get(parentId)
        }
      })

      return set
    }

    const buildLayout = () => {
      let leafIndex = 0
      let maxDepth = 0
      const nodes = []
      const edges = []

      const visit = (node, depth, parent) => {
        maxDepth = Math.max(maxDepth, depth)
        const visibleChildren = expanded.has(node.id) ? sortChildren(node.children) : []
        const childLayouts = visibleChildren.map(child => visit(child, depth + 1, node))

        let y
        if (childLayouts.length) {
          y = (childLayouts[0].y + childLayouts[childLayouts.length - 1].y) / 2
        } else {
          y = PAD_Y + leafIndex * (NODE_HEIGHT + Y_GAP)
          leafIndex += 1
        }

        const item = {
          node,
          depth,
          x: PAD_X + depth * (NODE_WIDTH + X_GAP),
          y,
          parentId: parent ? parent.id : null
        }

        nodes.push(item)
        childLayouts.forEach(child => edges.push({ parent: item, child }))
        return item
      }

      visit(tree, 0, null)

      return {
        nodes,
        edges,
        width: PAD_X * 2 + (maxDepth + 1) * NODE_WIDTH + maxDepth * X_GAP,
        height: Math.max(360, PAD_Y * 2 + Math.max(1, leafIndex) * (NODE_HEIGHT + Y_GAP) - Y_GAP)
      }
    }

    const updateInfo = node => {
      if (!node) node = tree
      const href = resolveHref(node)
      const typeLabels = {
        root: '知识库',
        part: '模块',
        chapter: '章节',
        article: '主线文章',
        branch: '支线文章',
        appendix: node.children && node.children.length ? '附录' : '基础参考'
      }

      info.innerHTML = ''

      const eyebrow = document.createElement('div')
      eyebrow.className = 'geb-km-info-type'
      eyebrow.textContent = typeLabels[node.type] || '知识节点'
      info.appendChild(eyebrow)

      const title = document.createElement('div')
      title.className = 'geb-km-info-title'
      title.textContent = node.title || node.shortTitle || ''
      info.appendChild(title)

      if (node.summary) {
        const summary = document.createElement('p')
        summary.className = 'geb-km-info-summary'
        summary.textContent = node.summary
        info.appendChild(summary)
      }

      if (node.routes && node.routes.length) {
        const tags = document.createElement('div')
        tags.className = 'geb-km-info-routes'
        node.routes.forEach(routeId => {
          if (!routes[routeId]) return
          const tag = document.createElement('span')
          tag.textContent = routes[routeId].title
          tags.appendChild(tag)
        })
        info.appendChild(tags)
      }

      if (href) {
        const link = document.createElement('a')
        link.className = 'geb-km-open'
        link.href = href
        link.textContent = '打开文章 →'
        info.appendChild(link)
      } else if (node.children && node.children.length) {
        const hint = document.createElement('div')
        hint.className = 'geb-km-info-hint'
        hint.textContent = expanded.has(node.id) ? '点击节点收起内容' : '点击节点展开内容'
        info.appendChild(hint)
      }
    }

    const drawEdge = edge => {
      const startX = edge.parent.x + NODE_WIDTH
      const startY = edge.parent.y + NODE_HEIGHT / 2
      const endX = edge.child.x
      const endY = edge.child.y + NODE_HEIGHT / 2
      const bend = Math.max(36, (endX - startX) * 0.48)

      const path = createSvg('path')
      path.setAttribute('d', `M ${startX} ${startY} C ${startX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}`)
      path.setAttribute('class', 'geb-km-edge')
      svg.appendChild(path)
    }

    const drawNode = (item, routeSet) => {
      const node = item.node
      const group = createSvg('g')
      const hasChildren = !!(node.children && node.children.length)
      const href = resolveHref(node)
      const routeMatched = !routeSet || routeSet.has(node.id)

      group.setAttribute('class', [
        'geb-km-node',
        `is-${node.type}`,
        routeMatched ? 'is-route-match' : 'is-route-dim',
        selectedId === node.id ? 'is-selected' : ''
      ].filter(Boolean).join(' '))
      group.setAttribute('transform', `translate(${item.x},${item.y})`)
      group.setAttribute('tabindex', '0')
      group.setAttribute('role', href ? 'link' : 'button')
      group.setAttribute('aria-label', node.title || node.shortTitle || '')

      const rect = createSvg('rect')
      rect.setAttribute('width', NODE_WIDTH)
      rect.setAttribute('height', NODE_HEIGHT)
      rect.setAttribute('rx', '11')
      rect.setAttribute('ry', '11')
      rect.setAttribute('class', 'geb-km-node-box')
      group.appendChild(rect)

      const text = createSvg('text')
      text.setAttribute('x', '16')
      text.setAttribute('y', String(NODE_HEIGHT / 2 + 5))
      text.setAttribute('class', 'geb-km-node-text')
      text.textContent = node.shortTitle || node.title || node.id
      group.appendChild(text)

      if (hasChildren) {
        const circle = createSvg('circle')
        circle.setAttribute('cx', String(NODE_WIDTH - 18))
        circle.setAttribute('cy', String(NODE_HEIGHT / 2))
        circle.setAttribute('r', '10')
        circle.setAttribute('class', 'geb-km-toggle-circle')
        group.appendChild(circle)

        const mark = createSvg('text')
        mark.setAttribute('x', String(NODE_WIDTH - 18))
        mark.setAttribute('y', String(NODE_HEIGHT / 2 + 4))
        mark.setAttribute('text-anchor', 'middle')
        mark.setAttribute('class', 'geb-km-toggle-mark')
        mark.textContent = expanded.has(node.id) ? '−' : '+'
        group.appendChild(mark)
      }

      const nativeTitle = createSvg('title')
      nativeTitle.textContent = node.summary ? `${node.title}\n${node.summary}` : node.title
      group.appendChild(nativeTitle)

      const activate = () => {
        selectedId = node.id
        updateInfo(node)

        if (hasChildren) {
          if (expanded.has(node.id)) expanded.delete(node.id)
          else expanded.add(node.id)
          render()
          return
        }

        if (href) window.location.href = href
      }

      group.addEventListener('click', activate)
      group.addEventListener('mouseenter', () => updateInfo(node))
      group.addEventListener('focus', () => updateInfo(node))
      group.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        activate()
      })

      svg.appendChild(group)
    }

    const render = () => {
      const layout = buildLayout()
      const routeSet = getRouteSet()
      svg.innerHTML = ''
      svg.setAttribute('viewBox', `0 0 ${layout.width} ${layout.height}`)
      svg.style.width = `${layout.width}px`
      svg.style.height = `${layout.height}px`

      layout.edges.forEach(drawEdge)
      layout.nodes
        .sort((a, b) => a.depth - b.depth)
        .forEach(item => drawNode(item, routeSet))

      const selected = nodeById.get(selectedId) || tree
      updateInfo(selected)

      if (canvas && selected) {
        const selectedLayout = layout.nodes.find(item => item.node.id === selected.id)
        if (selectedLayout && selectedLayout.x > canvas.clientWidth) {
          canvas.scrollLeft = Math.max(0, selectedLayout.x - 40)
        }
      }
    }

    renderRouteButtons()
    renderSidebarRoutes()
    render()
  }

  const initAllKnowledgeMaps = () => {
    document.querySelectorAll('[data-geb-knowledge-map]').forEach(initKnowledgeMap)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllKnowledgeMaps)
  } else {
    initAllKnowledgeMaps()
  }

  window.addEventListener('hexo-blog-decrypt', initAllKnowledgeMaps)
  document.addEventListener('pjax:complete', initAllKnowledgeMaps)
})()
