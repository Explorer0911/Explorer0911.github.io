(function () {
  const PLAYLIST_URL = '/music/playlist.json'
  const STORAGE_ALBUM_KEY = 'blog-music-current-album'
  const STORAGE_TRACK_KEY = 'blog-music-current-track'
  const STORAGE_VOLUME_KEY = 'blog-music-volume'
  const DEFAULT_VOLUME = 0.75

  const state = {
    playlist: null,
    albums: [],
    currentAlbumIndex: 0,
    currentTrackIndex: 0,
    loading: false,
    error: ''
  }

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

  const readStoredAlbumId = () => window.localStorage.getItem(STORAGE_ALBUM_KEY) || ''

  const saveStoredAlbumId = albumId => {
    if (!albumId) return
    window.localStorage.setItem(STORAGE_ALBUM_KEY, albumId)
  }

  const readStoredTrackIndex = () => {
    const raw = window.localStorage.getItem(STORAGE_TRACK_KEY)
    const value = Number(raw)
    return Number.isFinite(value) ? Math.max(0, value) : 0
  }

  const saveStoredTrackIndex = index => {
    window.localStorage.setItem(STORAGE_TRACK_KEY, String(index))
  }

  const readStoredVolume = () => {
    const raw = window.localStorage.getItem(STORAGE_VOLUME_KEY)
    const value = Number(raw)
    return Number.isFinite(value) ? clamp(value, 0, 1) : DEFAULT_VOLUME
  }

  const saveStoredVolume = volume => {
    window.localStorage.setItem(STORAGE_VOLUME_KEY, String(clamp(volume, 0, 1)))
  }

  const formatVolume = volume => Math.round(clamp(volume, 0, 1) * 100) + '%'

  const ensureAudio = () => {
    if (window.__blogMusicAudio) return window.__blogMusicAudio

    const audio = document.createElement('audio')
    audio.preload = 'none'
    audio.volume = readStoredVolume()
    audio.muted = audio.volume === 0
    audio.addEventListener('play', render)
    audio.addEventListener('pause', render)
    audio.addEventListener('volumechange', render)
    audio.addEventListener('ended', () => stepTrack(1, true))
    audio.addEventListener('loadedmetadata', render)
    audio.addEventListener('error', () => {
      state.error = '这首歌暂时无法播放，请检查音频路径。'
      render()
    })

    window.__blogMusicAudio = audio
    return audio
  }

  const applyVolume = nextVolume => {
    const audio = ensureAudio()
    const volume = clamp(nextVolume, 0, 1)
    audio.volume = volume
    audio.muted = volume === 0
    saveStoredVolume(volume)
    render()
  }

  const toggleMute = () => {
    const audio = ensureAudio()
    if (audio.muted || audio.volume === 0) {
      const restored = readStoredVolume() || DEFAULT_VOLUME
      audio.muted = false
      audio.volume = clamp(restored, 0.05, 1)
      saveStoredVolume(audio.volume)
    } else {
      audio.muted = true
    }
    render()
  }

  const normalizeTracks = tracks => {
    if (!Array.isArray(tracks)) return []

    return tracks
      .filter(item => item && typeof item === 'object' && item.src && item.title)
      .map((item, index) => ({
        id: item.id || ('track-' + (index + 1)),
        title: item.title,
        artist: item.artist || '',
        src: item.src,
        cover: item.cover || '',
        note: item.note || ''
      }))
  }

  const normalizeAlbums = (playlistTitle, albums) => {
    if (!Array.isArray(albums)) return []

    return albums
      .filter(item => item && typeof item === 'object')
      .map((item, index) => ({
        id: item.id || ('album-' + (index + 1)),
        title: item.title || (playlistTitle ? playlistTitle + ' ' + (index + 1) : '未命名专辑'),
        artist: item.artist || '未知艺术家',
        cover: item.cover || '',
        description: item.description || '',
        tracks: normalizeTracks(item.tracks)
      }))
      .filter(item => item.tracks.length)
  }

  const normalizePlaylist = playlist => {
    const raw = playlist && typeof playlist === 'object' ? playlist : {}
    let albums = normalizeAlbums(raw.title || '我的歌单', raw.albums)

    if (!albums.length && Array.isArray(raw.tracks)) {
      albums = [
        {
          id: 'album-1',
          title: raw.title || '我的歌单',
          artist: raw.artist || '未知艺术家',
          cover: raw.cover || '',
          description: raw.description || '',
          tracks: normalizeTracks(raw.tracks)
        }
      ].filter(item => item.tracks.length)
    }

    return {
      title: raw.title || '我的歌单',
      description: raw.description || '这里会读取 /music/playlist.json。',
      albums: albums
    }
  }

  const getCurrentAlbum = () => state.albums[state.currentAlbumIndex] || null

  const getCurrentTracks = () => {
    const album = getCurrentAlbum()
    return album ? album.tracks : []
  }

  const getCurrentTrack = () => getCurrentTracks()[state.currentTrackIndex] || null

  const closeMusicCard = () => {
    const card = document.querySelector('.music-card-widget')
    if (card) card.classList.remove('is-open')
  }

  const toggleMusicCard = () => {
    const card = document.querySelector('.music-card-widget')
    if (!card) return
    card.classList.toggle('is-open')
  }

  const setStatus = message => {
    const status = document.querySelector('.music-card-widget__status')
    if (status) status.textContent = message
  }

  const loadTrack = index => {
    const tracks = getCurrentTracks()
    if (!tracks.length) return

    const safeIndex = (index + tracks.length) % tracks.length
    state.currentTrackIndex = safeIndex
    saveStoredTrackIndex(safeIndex)

    const album = getCurrentAlbum()
    if (album) saveStoredAlbumId(album.id)
    state.error = ''

    const track = getCurrentTrack()
    const audio = ensureAudio()

    if (!track) return
    if (audio.getAttribute('src') !== track.src) {
      audio.src = track.src
    }

    render()
  }

  const selectAlbum = async (index, autoplay) => {
    if (!state.albums.length) return

    const safeIndex = clamp(index, 0, state.albums.length - 1)
    state.currentAlbumIndex = safeIndex
    state.currentTrackIndex = 0

    const album = getCurrentAlbum()
    if (album) saveStoredAlbumId(album.id)
    saveStoredTrackIndex(0)

    loadTrack(0)

    if (autoplay) {
      const audio = ensureAudio()
      try {
        await audio.play()
      } catch (error) {
        state.error = '专辑已切换，但浏览器没有继续自动播放。'
      }
    }

    render()
  }

  const togglePlayback = async () => {
    const track = getCurrentTrack()
    if (!track) {
      state.error = '当前专辑里还没有可播放的歌曲。'
      render()
      return
    }

    const audio = ensureAudio()
    if (audio.getAttribute('src') !== track.src) {
      loadTrack(state.currentTrackIndex)
    }

    if (audio.paused) {
      try {
        await audio.play()
        state.error = ''
      } catch (error) {
        state.error = '浏览器拦住了自动播放，请再点一次播放。'
      }
    } else {
      audio.pause()
    }

    render()
  }

  const stepTrack = async (direction, autoplay) => {
    const tracks = getCurrentTracks()
    if (!tracks.length) return

    loadTrack(state.currentTrackIndex + direction)
    const audio = ensureAudio()

    if (autoplay) {
      try {
        await audio.play()
      } catch (error) {
        state.error = '切歌成功，但浏览器没有继续自动播放。'
      }
    }

    render()
  }

  const renderTrackList = () => {
    const list = document.querySelector('.music-card-widget__list')
    if (!list) return

    const tracks = getCurrentTracks()
    if (!tracks.length) {
      list.innerHTML = '<li class="music-card-widget__empty">当前专辑还没有歌曲。把音频放到 <code>/source/music/</code>，再更新 <code>playlist.json</code>。</li>'
      return
    }

    list.innerHTML = tracks
      .map((track, index) => {
        const active = index === state.currentTrackIndex ? ' is-active' : ''
        const artist = track.artist || (getCurrentAlbum() ? getCurrentAlbum().artist : '未知艺术家')
        return [
          '<li class="music-card-widget__item' + active + '">',
          '  <button type="button" class="music-card-widget__track" data-track-index="' + index + '">',
          '    <span class="music-card-widget__track-title">' + track.title + '</span>',
          '    <span class="music-card-widget__track-artist">' + artist + '</span>',
          '  </button>',
          '</li>'
        ].join('')
      })
      .join('')
  }

  const renderAlbumOptions = () => {
    const select = document.querySelector('.music-card-widget__album-select')
    if (!select) return

    if (!state.albums.length) {
      select.innerHTML = '<option value="">还没有专辑</option>'
      select.disabled = true
      return
    }

    select.disabled = false
    select.innerHTML = state.albums
      .map((album, index) => {
        const selected = index === state.currentAlbumIndex ? ' selected' : ''
        return '<option value="' + index + '"' + selected + '>' + album.title + '</option>'
      })
      .join('')
  }

  const render = () => {
    const title = document.querySelector('.music-card-widget__title')
    const desc = document.querySelector('.music-card-widget__desc')
    const cover = document.querySelector('.music-card-widget__cover')
    const albumMeta = document.querySelector('.music-card-widget__album-meta')
    const nowTitle = document.querySelector('.music-card-widget__now-title')
    const nowArtist = document.querySelector('.music-card-widget__now-artist')
    const playButton = document.querySelector('[data-action="toggle-play"]')
    const muteButton = document.querySelector('[data-action="toggle-mute"]')
    const volumeSlider = document.querySelector('.music-card-widget__volume-slider')
    const volumeValue = document.querySelector('.music-card-widget__volume-value')
    const count = document.querySelector('.music-card-widget__count')

    if (!title || !desc || !cover || !albumMeta || !nowTitle || !nowArtist || !playButton || !muteButton || !volumeSlider || !volumeValue || !count) {
      return
    }

    const playlistTitle = (state.playlist && state.playlist.title) || '我的歌单'
    const playlistDesc = state.error || (state.playlist && state.playlist.description) || '这里会读取 /music/playlist.json。'
    const album = getCurrentAlbum()
    const track = getCurrentTrack()
    const audio = ensureAudio()
    const effectiveVolume = audio.muted ? 0 : audio.volume
    const albumArtist = album ? album.artist : '未知艺术家'
    const trackArtist = track && track.artist ? track.artist : albumArtist
    const coverImage = (track && track.cover) || (album && album.cover) || ''

    title.textContent = playlistTitle
    desc.textContent = playlistDesc
    count.textContent = getCurrentTracks().length + ' tracks'
    albumMeta.textContent = album ? (albumArtist + ' · ' + album.title) : '还没有专辑'
    nowTitle.textContent = track ? track.title : '还没有可播放歌曲'
    nowArtist.textContent = track ? trackArtist : '先上传音频，再把信息写进 playlist.json'
    playButton.textContent = audio.paused ? '播放' : '暂停'
    muteButton.textContent = audio.muted || audio.volume === 0 ? '取消静音' : '静音'
    volumeSlider.value = String(Math.round(effectiveVolume * 100))
    volumeValue.textContent = formatVolume(effectiveVolume)

    if (coverImage) {
      cover.style.backgroundImage = "linear-gradient(135deg, rgba(14, 165, 160, 0.2), rgba(15, 23, 42, 0.1)), url('" + coverImage + "')"
      cover.classList.add('has-cover')
    } else {
      cover.style.backgroundImage = ''
      cover.classList.remove('has-cover')
    }

    renderAlbumOptions()
    renderTrackList()
    setStatus(state.loading ? '正在读取歌单…' : '手动播放，浏览器会记住当前专辑、曲目和音量。')
  }

  const ensureMusicCard = () => {
    let card = document.querySelector('.music-card-widget')
    if (card) return card

    card = document.createElement('div')
    card.className = 'music-card-widget'
    card.innerHTML = [
      '<div class="music-card-widget__header">',
      '  <div>',
      '    <div class="music-card-widget__eyebrow">Music</div>',
      '    <h3 class="music-card-widget__title">我的歌单</h3>',
      '  </div>',
      '  <button class="music-card-widget__close" type="button" aria-label="关闭音乐卡片">×</button>',
      '</div>',
      '<p class="music-card-widget__desc">这里会读取 /music/playlist.json。</p>',
      '<div class="music-card-widget__album-bar">',
      '  <label class="music-card-widget__album-label" for="music-card-album-select">专辑</label>',
      '  <select id="music-card-album-select" class="music-card-widget__album-select" aria-label="切换专辑">',
      '    <option value="">还没有专辑</option>',
      '  </select>',
      '</div>',
      '<div class="music-card-widget__now">',
      '  <div class="music-card-widget__cover">',
      '    <span class="music-card-widget__cover-icon"><i class="fas fa-music"></i></span>',
      '  </div>',
      '  <div class="music-card-widget__meta">',
      '    <div class="music-card-widget__count">0 tracks</div>',
      '    <div class="music-card-widget__album-meta">还没有专辑</div>',
      '    <div class="music-card-widget__now-title">还没有可播放歌曲</div>',
      '    <div class="music-card-widget__now-artist">先上传音频，再把信息写进 playlist.json</div>',
      '  </div>',
      '</div>',
      '<div class="music-card-widget__controls">',
      '  <button class="music-card-widget__control" type="button" data-action="prev">上一首</button>',
      '  <button class="music-card-widget__control music-card-widget__control--primary" type="button" data-action="toggle-play">播放</button>',
      '  <button class="music-card-widget__control" type="button" data-action="next">下一首</button>',
      '</div>',
      '<div class="music-card-widget__volume">',
      '  <button class="music-card-widget__mute" type="button" data-action="toggle-mute">静音</button>',
      '  <input class="music-card-widget__volume-slider" type="range" min="0" max="100" step="1" value="75" aria-label="调整音量">',
      '  <span class="music-card-widget__volume-value">75%</span>',
      '</div>',
      '<div class="music-card-widget__status" aria-live="polite">正在读取歌单…</div>',
      '<ul class="music-card-widget__list"></ul>'
    ].join('')

    card.addEventListener('click', event => {
      const actionButton = event.target.closest('[data-action]')
      const trackButton = event.target.closest('[data-track-index]')
      const closeButton = event.target.closest('.music-card-widget__close')

      if (closeButton) {
        closeMusicCard()
        return
      }

      if (trackButton) {
        const index = Number(trackButton.getAttribute('data-track-index'))
        loadTrack(index)
        togglePlayback()
        return
      }

      if (!actionButton) return
      const action = actionButton.getAttribute('data-action')

      if (action === 'prev') stepTrack(-1, true)
      if (action === 'next') stepTrack(1, true)
      if (action === 'toggle-play') togglePlayback()
      if (action === 'toggle-mute') toggleMute()
    })

    card.addEventListener('input', event => {
      const slider = event.target.closest('.music-card-widget__volume-slider')
      if (!slider) return
      applyVolume(Number(slider.value) / 100)
    })

    card.addEventListener('change', event => {
      const select = event.target.closest('.music-card-widget__album-select')
      if (!select) return
      selectAlbum(Number(select.value), false)
    })

    document.body.appendChild(card)
    return card
  }

  const ensureMusicToggle = () => {
    let button = document.querySelector('#music-card-toggle')
    if (button) return button

    button = document.createElement('button')
    button.id = 'music-card-toggle'
    button.type = 'button'
    button.title = '音乐播放器'
    button.setAttribute('aria-label', '打开音乐播放器')
    button.innerHTML = '<i class="fas fa-music"></i><span>音乐</span>'
    button.addEventListener('click', event => {
      event.stopPropagation()
      toggleMusicCard()
    })
    document.body.appendChild(button)
    return button
  }

  const bindMusicClose = () => {
    if (window.__musicCardBound) return
    window.__musicCardBound = true

    document.addEventListener('click', event => {
      const insideCard = event.target.closest('.music-card-widget')
      const onToggle = event.target.closest('#music-card-toggle')
      if (!insideCard && !onToggle) closeMusicCard()
    })
  }

  const loadPlaylist = async () => {
    if (state.loading) return
    state.loading = true
    render()

    try {
      const response = await fetch(PLAYLIST_URL, { cache: 'no-store' })
      if (!response.ok) throw new Error('playlist fetch failed')

      const playlist = normalizePlaylist(await response.json())
      state.playlist = playlist
      state.albums = playlist.albums

      const storedAlbumId = readStoredAlbumId()
      const storedAlbumIndex = state.albums.findIndex(album => album.id === storedAlbumId)
      state.currentAlbumIndex = storedAlbumIndex >= 0 ? storedAlbumIndex : 0

      const tracks = getCurrentTracks()
      state.currentTrackIndex = tracks.length ? clamp(readStoredTrackIndex(), 0, tracks.length - 1) : 0

      if (state.albums.length && getCurrentAlbum()) {
        saveStoredAlbumId(getCurrentAlbum().id)
      }
      saveStoredTrackIndex(state.currentTrackIndex)

      if (tracks.length) loadTrack(state.currentTrackIndex)
      state.error = ''
    } catch (error) {
      state.playlist = {
        title: '我的歌单',
        description: '暂时没读到 playlist.json。你可以先把文件放到 /source/music/ 里。',
        albums: []
      }
      state.albums = []
      state.currentAlbumIndex = 0
      state.currentTrackIndex = 0
      state.error = '歌单还没准备好，但播放器框架已经在了。'
    } finally {
      state.loading = false
      render()
    }
  }

  const init = () => {
    ensureAudio()
    ensureMusicCard()
    ensureMusicToggle()
    bindMusicClose()
    loadPlaylist()
    render()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }

  document.addEventListener('pjax:complete', init)
})()