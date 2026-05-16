let currentUrl = ''
const DEVICE_KEY = 'gpt_checkout_device_id'
const PENDING_PAYMENT_KEY = 'gpt_checkout_pending_payment'

function escapeHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')
}

function getSourcePayload(event, email) {
  const params = new URLSearchParams(location.search)
  return {
    event,
    device_id: getDeviceId(),
    email: email || '',
    landing_url: location.href,
    referrer: document.referrer || '',
    utm_source: params.get('utm_source') || '',
    utm_medium: params.get('utm_medium') || '',
    utm_campaign: params.get('utm_campaign') || '',
    utm_content: params.get('utm_content') || '',
    utm_term: params.get('utm_term') || '',
    user_agent: navigator.userAgent || '',
  }
}

async function trackSource(event, email) {
  try {
    await fetch('/api/source-track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(getSourcePayload(event, email)),
    })
  } catch {}
}

function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id = `dev_${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(16).slice(2)}`}`
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}

function applyClosedMode() {
  const overlay = document.getElementById('closed-overlay')
  document.body.classList.remove('closed-mode')
  if (overlay) overlay.style.display = 'none'
}

applyClosedMode()

async function loadClosedMode() {
  try {
    const r = await fetch('/api/admin?site_state=1')
    const d = await r.json()
    const overlay = document.getElementById('closed-overlay')
    if (d.closed) {
      document.body.classList.add('closed-mode')
      if (overlay) overlay.style.display = 'flex'
      return
    }
    document.body.classList.remove('closed-mode')
    if (overlay) overlay.style.display = 'none'
  } catch {}
}
const getAutoLang = () => 'id'
let lang = 'id'
const activeLang = () => 'id'
let countryMode = 'ID'
const countryMeta = {
  ID: { currency: 'IDR', label: 'Indonesia' },
}
function autoCountry() {
  return 'ID'
}
const activeCountry = () => countryMode === 'auto' ? autoCountry() : countryMode
const i18n = {
  id: {
    subtitle: 'Cek promo GPT Plus untuk akun yang eligible',
    planSub: 'IDR · Indonesia · pembayaran lokal',
    sessionLabel: 'Session Akun',
    sessionPlaceholder: 'Tempel JSON dari chatgpt.com/api/auth/session...',
    hintOpen: 'Buka',
    hintCopy: 'saat sudah login, copy semua JSON, lalu paste ke atas.',
    generate: 'Buat Link',
    resultTitle: 'Link berhasil dibuat!',
    openLink: 'Buka Link',
    support: 'Donate opsional',
    skip: 'Lewati',
    donate: 'Donate',
    donateMini: 'Donate opsional kalau terbantu',
    donateLimit: 'Bayar dulu untuk generate lagi.',
    limitNote: 'Cek promo GPT Plus untuk akun yang eligible.',
    pasteSession: 'Tempel session JSON dulu sebelum buat link',
    invalidResponse: 'Response tidak valid dari server',
    failedGenerate: 'Gagal membuat link checkout',
    contactDev: 'Hubungi developer',
    network: 'Koneksi error',
    copied: 'Tersalin!',
    history: 'Riwayat Akun',
  },
}
const t = (key) => i18n[activeLang()][key] || i18n.id[key] || key

function applyLocale() {
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n) })
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder) })
  applyCountry()
}

function applyCountry() {
  const select = document.getElementById('country-select')
  if (select) select.value = countryMode
  const country = activeCountry()
  const meta = countryMeta[country] || countryMeta.ID
  const planSub = document.querySelector('[data-i18n="planSub"]')
  if (planSub) planSub.textContent = `${meta.currency} · ${meta.label}`
}
applyLocale()
trackSource('page_view', '')

const countrySelect = document.getElementById('country-select')
if (countrySelect) {
  countrySelect.addEventListener('change', () => {
    countryMode = countrySelect.value
      localStorage.setItem('country', 'ID')
    applyCountry()
  })
}

function showError(msg) {
  const box = document.getElementById('error-box')
  const txt = document.getElementById('error-text')
  if (!box || !txt) return
  txt.textContent = msg
  box.classList.add('show')
  document.getElementById('result-box').classList.remove('show')
}

function renderLogs(logs) {
  const box = document.getElementById('status-box')
  if (!box) return
  if (!Array.isArray(logs) || logs.length === 0) {
    box.classList.remove('show')
    box.innerHTML = ''
    return
  }
  box.innerHTML = ''
  logs.forEach((log) => {
    const row = document.createElement('div')
    const name = document.createElement('span')
    const msg = document.createElement('span')
    row.className = `status-row ${log.ok ? 'ok' : 'fail'}`
    name.className = 'status-name'
    msg.className = 'status-msg'
    name.textContent = log.step
    msg.textContent = log.message
    row.append(name, msg)
    box.appendChild(row)
  })
  box.classList.add('show')
}

function hideError() {
  const box = document.getElementById('error-box')
  if (box) box.classList.remove('show')
}

async function handleGenerate() {
  const session = document.getElementById('session').value.trim()
  if (!session) {
    showError(t('pasteSession'))
    return
  }
  doGenerate(session)
}

async function doGenerate(session) {
  hideError()
  renderLogs([{ step: 'Start', ok: true, message: 'Memproses session' }])
  const btn = document.getElementById('generate-btn')
  const label = btn.querySelector('span')
  btn.disabled = true
  label.textContent = 'Memproses...'

  try {
    let parsedEmail = ''
    try {
      const parsed = JSON.parse(session)
      parsedEmail = parsed.user?.email || parsed.email || ''
    } catch {}
    trackSource('generate_attempt', parsedEmail)
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session, country: activeCountry(), device_id: getDeviceId() }),
    })

    let data
    try {
      data = await res.json()
    } catch {
      showError(t('invalidResponse'))
      return
    }

    if (!data.success || (!data.url && !data.locked)) {
      renderLogs(data.logs)
      if (data.has_pending) {
        // Bypass: skip donate requirement, just show error
        showError(data.error || t('failedGenerate'))
        return
      }
      if (false && data.has_pending) {
        window._unlockGenerateId = data.generate_id || 0
        window._unlockShareToken = data.share_token || ''
        window._unlockEmail = data.email || ''
        window._unlockAmount = data.unlock_amount || 10000
        localStorage.setItem('pending_unlock', JSON.stringify({
          invoice: data.invoice || '',
          qrisUrl: data.qris_url || '',
          email: data.email || '',
          generate_id: data.generate_id || 0,
          share_token: data.share_token || '',
          final_amount: data.unlock_amount || 10000,
          discount_amount: data.discount_amount || 0,
          share_count: data.share_count || 0,
          saved_at: Date.now(),
        }))
        setPendingClaimState(true, { final_amount: window._unlockAmount || 10000 })
        startUnlockSharePolling(window._unlockShareToken)
      }
      showError(data.error || t('failedGenerate'))
      return
    }

    renderLogs(data.logs)

    if (data.locked) {
      // Bypass: jika ada URL meski locked, tetap tampilkan
      if (data.url) {
        currentUrl = data.url
      } else {
        showError('Link tidak tersedia.')
        return
      }
    }

    currentUrl = data.url
    document.getElementById('link-display').textContent = currentUrl
    document.getElementById('link-display').classList.remove('revealed')

    const promoTag = document.getElementById('promo-tag')
    if (promoTag) {
      promoTag.textContent = data.promoEligible ? 'Promo IDR 0 berhasil!' : 'Promo tidak eligible'
      promoTag.className = 'promo-tag ' + (data.promoEligible ? 'promo-ok' : 'promo-no')
    }

    document.getElementById('result-box').classList.add('show')
    renderAccount(data.account, data.codexUsage, data.promoEligible)

  } catch (err) {
    showError(`${t('network')}: ${err.message}`)
  } finally {
    btn.disabled = false
    label.textContent = t('generate')
  }
}

function closeResult() {
  document.getElementById('result-box').classList.remove('show')
}

function renderAccount(account, codex, promo) {
}

function formatRupiah(amount) {
  const n = parseInt(amount, 10) || 0
  return `Rp ${n.toLocaleString('id-ID')}`
}

function setPendingClaimState(visible, info = {}) {
  // Bypass: selalu tampilkan session area, jangan sembunyikan
  const sessionArea = document.getElementById('session-area')
  if (sessionArea) sessionArea.classList.remove('is-hidden')
}

function buildShareLink(token, source) {
  const url = new URL(location.origin + '/')
  if (token) url.searchParams.set('share', token)
  if (source) url.searchParams.set('share_source', source)
  return url.toString()
}

function getActiveShareLink() {
  const token = window._unlockShareToken || ''
  return buildShareLink(token)
}

function shareTargets(url) {
  const encoded = encodeURIComponent(url)
  const text = encodeURIComponent('Claim promo GPT Plus di sini')
  return [
    { title: 'WhatsApp', source: 'whatsapp', url: `https://wa.me/?text=${text}%20${encoded}`, icon: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3a8.5 8.5 0 0 0-7.37 12.74L4 21l5.42-1.42A8.5 8.5 0 1 0 12 3Z" fill="#25D366"/><path d="M9.37 7.95c-.2-.44-.42-.45-.62-.46h-.53c-.18 0-.48.07-.73.34-.25.27-.95.93-.95 2.26 0 1.33.97 2.62 1.1 2.8.14.18 1.89 3.03 4.67 4.13 2.3.91 2.78.73 3.28.68.5-.05 1.61-.66 1.84-1.3.23-.64.23-1.19.16-1.3-.07-.11-.25-.18-.52-.32s-1.61-.79-1.86-.88c-.25-.09-.43-.14-.61.14-.18.27-.7.88-.86 1.06-.16.18-.32.2-.6.07-.27-.14-1.16-.43-2.2-1.38-.81-.72-1.36-1.62-1.52-1.89-.16-.27-.02-.41.12-.54.12-.12.27-.32.41-.48.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.14-.62-1.5-.85-2.05Z" fill="#fff"/></svg>' },
    { title: 'Telegram', source: 'telegram', url: `https://t.me/share/url?url=${encoded}&text=${text}`, icon: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#229ED9"/><path d="m17.8 7.2-2.1 10.05c-.16.71-.58.89-1.17.56l-3.23-2.38-1.56 1.5c-.17.17-.32.32-.65.32l.23-3.3 6-5.42c.26-.23-.06-.36-.4-.13L7.5 13.08l-3.2-1c-.7-.22-.71-.7.14-1.03l12.5-4.82c.58-.21 1.08.13.89.97Z" fill="#fff"/></svg>' },
    { title: 'Facebook', source: 'facebook', url: `https://www.facebook.com/sharer/sharer.php?u=${encoded}`, icon: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#1877F2"/><path d="M13.05 19v-6.17h2.08l.31-2.4h-2.39V8.9c0-.7.2-1.17 1.2-1.17h1.28V5.58c-.22-.03-.98-.08-1.86-.08-1.84 0-3.1 1.12-3.1 3.19v1.74H8.5v2.4h2.07V19h2.48Z" fill="#fff"/></svg>' },
    { title: 'X', source: 'x', url: `https://twitter.com/intent/tweet?text=${text}&url=${encoded}`, icon: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M18.9 4H21l-4.6 5.25L22 20h-4.39l-3.44-6.54L8.56 20H6.44l4.92-5.62L2 4h4.5l3.11 5.96L14.84 4h4.06Zm-.77 14.56h1.22L5.84 5.36H4.53l13.6 13.2Z" fill="#111827"/></svg>' },
    { title: 'Discord', url: '', icon: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M18.9 6.5A16.1 16.1 0 0 0 15.1 5l-.18.36c1.53.4 2.24.98 2.24.98A14.02 14.02 0 0 0 12 5.4c-1.78 0-3.55.3-5.16.94 0 0 .75-.62 2.41-1.01L9.07 5A16.2 16.2 0 0 0 5.3 6.5C2.92 10.1 2.28 13.62 2.6 17.1a16.3 16.3 0 0 0 4.62 2.36l1.12-1.84c-.65-.23-1.27-.52-1.86-.88.5.37 1.08.68 1.72.9 1.21.42 2.48.64 3.8.64s2.59-.22 3.8-.64c.64-.22 1.22-.53 1.72-.9-.59.36-1.21.65-1.86.88l1.12 1.84a16.3 16.3 0 0 0 4.62-2.36c.38-4.03-.65-7.52-2.98-10.6ZM9.56 14.98c-.74 0-1.34-.69-1.34-1.53 0-.84.6-1.53 1.34-1.53s1.34.69 1.34 1.53c0 .84-.59 1.53-1.34 1.53Zm4.88 0c-.74 0-1.34-.69-1.34-1.53 0-.84.6-1.53 1.34-1.53.74 0 1.34.69 1.34 1.53 0 .84-.6 1.53-1.34 1.53Z" fill="#5865F2"/></svg>' },
    { title: 'Instagram', url: '', icon: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="5" stroke="#E1306C" stroke-width="2"/><circle cx="12" cy="12" r="3.5" stroke="#E1306C" stroke-width="2"/><circle cx="17" cy="7" r="1" fill="#E1306C"/></svg>' },
    { title: 'TikTok', url: '', icon: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14.5 4c.44 1.3 1.27 2.3 2.5 2.98.7.39 1.46.58 2.28.58v2.63c-1.32 0-2.57-.35-3.74-1.04v5.04c0 3.01-2.46 5.45-5.5 5.45s-5.5-2.44-5.5-5.45 2.46-5.45 5.5-5.45c.28 0 .56.02.83.07v2.74a2.73 2.73 0 0 0-.83-.13c-1.5 0-2.72 1.2-2.72 2.77 0 1.53 1.19 2.77 2.72 2.77 1.5 0 2.72-1.2 2.72-2.77V4h2.74Z" fill="#111827"/></svg>' },
    { title: 'Threads', url: '', icon: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15.7 11.5c-.13-.06-.26-.12-.4-.17-.26-1.66-1.33-2.63-3.06-2.63-1.9 0-3.16 1.08-3.23 2.7h1.72c.07-.73.56-1.15 1.47-1.15.78 0 1.23.29 1.46.9-1.86-.27-4.58.08-4.58 2.5 0 1.5 1.15 2.4 2.87 2.4 1.37 0 2.3-.57 2.8-1.56.18.16.37.31.57.44.7.45 1.58.69 2.52.69v-1.58c-.59 0-1.08-.14-1.48-.4.05-.25.08-.51.08-.79 0-.87-.28-1.62-.74-2.18Zm-3.6 3.07c-.75 0-1.2-.32-1.2-.85 0-.9 1.34-1.02 2.94-.78-.16 1.01-.76 1.63-1.74 1.63Zm4.98-4.96c-.38-.76-.96-1.37-1.68-1.78-.8-.45-1.8-.68-2.97-.68-2.73 0-4.75 1.83-4.75 4.64 0 2.85 2.05 4.66 4.92 4.66 1.58 0 2.86-.47 3.7-1.35.8-.84 1.21-1.97 1.21-3.35 0-.83-.15-1.57-.43-2.14Z" fill="#111827"/></svg>' },
  ]
}

function openShareMenu() {
  const popup = document.getElementById('payment-popup')
  if (!popup) return
  const buttons = shareTargets(getActiveShareLink()).map(target => {
    const url = getActiveShareLink(target.source || '')
    let shareUrl = ''
    if (target.source === 'whatsapp') shareUrl = `https://wa.me/?text=${encodeURIComponent(`Claim promo GPT Plus di sini ${url}`)}`
    if (target.source === 'telegram') shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent('Claim promo GPT Plus di sini')}`
    if (target.source === 'facebook') shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
    if (target.source === 'x') shareUrl = `https://x.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent('Claim promo GPT Plus di sini')}`
    if (shareUrl) return `<button class="share-option" type="button" title="${target.title}" aria-label="${target.title}" onclick="window.open('${shareUrl}','_blank')">${target.icon}</button>`
    return `<button class="share-option" type="button" title="${target.title}" aria-label="${target.title}" onclick="copyShareLink()">${target.icon}</button>`
  }).join('')
  popup.innerHTML = `<div class="popup-card" style="grid-template-columns:1fr;text-align:center;gap:12px">
    <div class="popup-title">Share Link</div>
    <div class="popup-text">Pilih platform atau copy link share.</div>
    <div class="link-display" style="filter:none;user-select:text;white-space:normal;word-break:break-all">${escapeHtml(getActiveShareLink())}</div>
    <div class="popup-actions" style="grid-template-columns:repeat(4,1fr)">${buttons}</div>
    <div class="popup-actions" style="grid-template-columns:1fr 1fr">
      <button class="btn btn-skip" type="button" onclick="closePopup()">Tutup</button>
      <button class="btn" type="button" onclick="copyShareLink()">Copy Link</button>
    </div>
  </div>`
  popup.classList.add('show')
}

function copyShareLink() {
  navigator.clipboard.writeText(getActiveShareLink()).catch(() => {})
}

async function refreshUnlockShareStatus(token) {
  if (!token) return null
  try {
    const r = await fetch('/api/payment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'share_status', share_token: token }) })
    const d = await r.json()
    if (!r.ok || !d.ok) return null
    const info = document.getElementById('unlock-share-info')
    if (info) info.textContent = `Donate ${formatRupiah(d.final_amount || 10000)}`
    const payBtn = document.getElementById('unlock-pay-btn')
    if (payBtn) payBtn.textContent = `Donate ${formatRupiah(d.final_amount || 10000)}`
    setPendingClaimState(true, d)
    window._unlockAmount = d.final_amount || 10000
    return d
  } catch {
    return null
  }
}

function stopUnlockSharePolling() {
  if (window._unlockShareTimer) {
    clearInterval(window._unlockShareTimer)
    window._unlockShareTimer = null
  }
}

function startUnlockSharePolling(token) {
  stopUnlockSharePolling()
  if (!token) return
  window._unlockShareTimer = setInterval(() => {
    refreshUnlockShareStatus(token)
  }, 4000)
}

async function createUnlockPayment() {
  if (!window._unlockGenerateId || !window._unlockShareToken) return
  try {
    const r = await fetch('/api/payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_unlock', generate_id: window._unlockGenerateId, share_token: window._unlockShareToken, device_id: getDeviceId() }),
    })
    const d = await r.json()
    if (!r.ok || !d.url || !d.invoice) return alert(d.error || 'Gagal buat payment unlock')
    localStorage.setItem('pending_unlock', JSON.stringify({ invoice: d.invoice, qrisUrl: d.url, email: window._unlockEmail || '', generate_id: window._unlockGenerateId, share_token: window._unlockShareToken, final_amount: d.final_amount || window._unlockAmount || 10000, discount_amount: d.discount_amount || 0, share_count: d.share_count || 0, saved_at: Date.now() }))
    setPendingClaimState(true, d)
    pollUnlock(d.invoice)
    window.open(d.url, '_blank')
  } catch {
    alert('Koneksi error')
  }
}

function shareUnlockLink() {
  const token = window._unlockShareToken || ''
  if (!token) return
  navigator.clipboard.writeText(buildShareLink(token)).catch(() => {})
  const statusEl = document.getElementById('unlock-share-status')
  if (statusEl) statusEl.textContent = 'Link share tersalin.'
}

function showUnlockPopup(invoice, qrisUrl, email, meta = {}) {
  const popup = document.getElementById('payment-popup')
  if (!popup) return
  const finalAmount = meta.unlock_amount || meta.final_amount || 10000
  const discountAmount = meta.discount_amount || 0
  const shareCount = meta.share_count || 0
  popup.innerHTML = `<div class="popup-card" style="grid-template-columns:1fr;text-align:center;gap:12px">
    <div class="popup-title">Promo GPT Plus Tersedia!</div>
    <div class="popup-text">Donate untuk buka akses Promo GPT Plus yang sudah digenerate</div>
    <div id="unlock-share-info" class="popup-text" style="font-weight:700;color:#059669">Donate ${formatRupiah(finalAmount)}</div>
    <div id="unlock-share-status" class="popup-text"></div>
    <div id="unlock-status" style="font-size:12px;color:#6b8cae">Menunggu pembayaran...</div>
    <div class="popup-actions" style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <button class="btn btn-skip" type="button" onclick="shareUnlockLink()">Share Link</button>
      <button class="btn" id="unlock-pay-btn" type="button" onclick="createUnlockPayment()">Donate ${formatRupiah(finalAmount)}</button>
    </div>
    <div class="popup-actions" style="display:grid;grid-template-columns:1fr;gap:8px">
      <button class="btn btn-skip" type="button" onclick="minimizeUnlock()">Tutup</button>
    </div>
  </div>`
  popup.classList.add('show')
  window._unlockInvoice = invoice
  window._unlockExtra = 5
  window._unlockGenerateId = meta.generate_id || 0
  window._unlockShareToken = meta.share_token || ''
  window._unlockEmail = email || ''
  window._unlockAmount = finalAmount
  if (invoice && qrisUrl) {
    localStorage.setItem('pending_unlock', JSON.stringify({ invoice, qrisUrl, email, generate_id: window._unlockGenerateId, share_token: window._unlockShareToken, final_amount: finalAmount, discount_amount: discountAmount, share_count: shareCount, saved_at: Date.now() }))
    pollUnlock(invoice)
  }
  if (!invoice && window._unlockGenerateId) {
    localStorage.setItem('pending_unlock', JSON.stringify({ invoice: '', qrisUrl: '', email, generate_id: window._unlockGenerateId, share_token: window._unlockShareToken, final_amount: finalAmount, discount_amount: discountAmount, share_count: shareCount, saved_at: Date.now() }))
  }
  setPendingClaimState(true, { share_count: shareCount, discount_amount: discountAmount, final_amount: finalAmount })
  refreshUnlockShareStatus(window._unlockShareToken)
  startUnlockSharePolling(window._unlockShareToken)
}

function minimizeUnlock() {
  stopUnlockSharePolling()
  document.getElementById('payment-popup').classList.remove('show')
  const banner = document.getElementById('pending-banner')
  const textEl = document.getElementById('pending-text')
  if (banner && textEl) {
    textEl.textContent = 'Donate dulu untuk akses link Promo GPT Plus yang sudah dibuat'
    banner.style.display = 'block'
  }
  setPendingClaimState(true, { share_count: 0, discount_amount: 0, final_amount: window._unlockAmount || 10000 })
}

function clearPendingUnlockUI() {
  localStorage.removeItem('pending_unlock')
  stopUnlockSharePolling()
  const banner = document.getElementById('pending-banner')
  const notif = document.getElementById('top-notif')
  const popup = document.getElementById('payment-popup')
  if (banner) banner.style.display = 'none'
  if (notif) notif.style.display = 'none'
  if (popup) popup.classList.remove('show')
  setPendingClaimState(false)
}

function readPendingUnlock() {
  try {
    const pending = JSON.parse(localStorage.getItem('pending_unlock') || 'null')
    if (!pending?.invoice && !pending?.generate_id && !pending?.share_token) return null
    const savedAt = Number(pending.saved_at || 0)
    if (savedAt && Date.now() - savedAt > 30 * 60 * 1000) {
      clearPendingUnlockUI()
      return null
    }
    return pending
  } catch {
    clearPendingUnlockUI()
    return null
  }
}

function clearPendingDonate() {
  localStorage.removeItem(PENDING_PAYMENT_KEY)
}

function pollPendingDonate(invoice) {
  if (!invoice) return
  let attempts = 0
  let interval = 3000
  const tick = async () => {
    attempts++
    try {
      const r = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify_invoice', invoice, device_id: getDeviceId() }),
      })
      const d = await r.json()
      if (d.paid && d.credited) {
        clearPendingDonate()
        await loadSlotInfo()
        return
      }
    } catch {}
    if (attempts >= 60) return
    interval = Math.min(interval * 1.2, 15000)
    setTimeout(tick, interval)
  }
  setTimeout(tick, interval)
}

async function resumePendingDonate() {
  try {
    const pending = JSON.parse(localStorage.getItem(PENDING_PAYMENT_KEY) || 'null')
    if (!pending?.invoice) return
    const r = await fetch('/api/payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify_invoice', invoice: pending.invoice, device_id: getDeviceId() }),
    })
    const d = await r.json()
    if (d.paid && d.credited) {
      clearPendingDonate()
      await loadSlotInfo()
      return
    }
    pollPendingDonate(pending.invoice)
  } catch {}
}

async function resumeUnlock() {
  // Bypass: clear semua state pending unlock, tidak perlu restore
  localStorage.removeItem('pending_unlock')
  clearPendingUnlockUI()
}

function openPendingUnlock() {
  const banner = document.getElementById('pending-banner')
  try {
    const pending = readPendingUnlock()
    if (pending?.invoice) {
      showUnlockPopup(pending.invoice, pending.qrisUrl, pending.email, pending)
      if (banner) banner.style.display = 'none'
      return
    }
    if (window._unlockGenerateId || window._unlockShareToken) {
      showUnlockPopup(window._unlockInvoice || '', '', window._unlockEmail || '', {
        generate_id: window._unlockGenerateId || 0,
        share_token: window._unlockShareToken || '',
        unlock_amount: window._unlockAmount || 10000,
      })
      if (banner) banner.style.display = 'none'
    }
  } catch {}
}

function selectUnlockAmount(amount, extra) {
  window._unlockExtra = extra
}

function pollUnlock(invoice) {
  let attempts = 0
  let interval = 3000
  const poll = async () => {
    attempts++
    const statusEl = document.getElementById('unlock-status')
    try {
      const r = await fetch('/api/payment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'unlock_link', invoice, device_id: getDeviceId() }) })
      const d = await r.json()
      if (d.paid && d.url) {
        clearPendingUnlockUI()
        currentUrl = d.url
        document.getElementById('link-display').textContent = currentUrl
        document.getElementById('result-box').classList.add('show')
        const promoTag = document.getElementById('promo-tag')
        if (promoTag) { promoTag.textContent = 'Claim promo berhasil!'; promoTag.className = 'promo-tag promo-ok' }
        loadAccounts()
        loadSlotInfo()
        return
      }
      if (d.paid && d.error) {
        if (statusEl) statusEl.textContent = d.error
        clearPendingUnlockUI()
        return
      }
      if (statusEl) statusEl.textContent = `Menunggu pembayaran... (${attempts * Math.round(interval/1000)}s)`
    } catch {}
    if (attempts >= 60) {
      if (statusEl) statusEl.textContent = 'Timeout. Hubungi admin kalau sudah bayar.'
      return
    }
    interval = Math.min(interval * 1.2, 15000)
    setTimeout(poll, interval)
  }
  setTimeout(poll, interval)
}

window.showUnlockPopup = showUnlockPopup

function copyLink() {
  if (!currentUrl) return
  navigator.clipboard.writeText(currentUrl).catch(() => {})
  const btn = document.getElementById('btn-copy')
  const txt = document.getElementById('copy-text')
  btn.classList.add('copied')
  txt.textContent = t('copied')
  setTimeout(() => {
    btn.classList.remove('copied')
    txt.textContent = 'Salin Link'
  }, 2000)
}

function openLink() {
  if (!currentUrl) return
  window.open(currentUrl, '_blank')
}

window.handleGenerate = handleGenerate
window.closeResult = closeResult
window.copyLink = copyLink
window.openLink = openLink
window.openShareMenu = openShareMenu
window.copyShareLink = copyShareLink

async function regenerateAccount(email) {
  if (!email) return
  try {
    const r = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'regenerate_session', device_id: getDeviceId(), email }),
    })
    const d = await r.json()
    if (!r.ok || !d.session) {
      showError(d.error || 'Session regenerate tidak ditemukan')
      return
    }
    document.getElementById('session').value = d.session
    await doGenerate(d.session)
  } catch (err) {
    showError(`Gagal regenerate: ${err.message}`)
  }
}

window.regenerateAccount = regenerateAccount

function showPaymentPopup(used, limit) {
}

function bonusForDonateAmount(amount) {
  if (amount >= 10000) return 5
  if (amount >= 5000) return 3
  if (amount >= 1000) return 1
  return 0
}

function closePopup() {
  document.getElementById('payment-popup').classList.remove('show')
}
function showDonate() {
  trackSource('donate_open', '')
  const popup = document.getElementById('payment-popup')
  if (!popup) return
  popup.innerHTML = `<div class="popup-card" style="grid-template-columns:1fr;text-align:center;gap:12px">
    <div class="popup-title">Donate</div>
    <div class="popup-text">Donate bebas dan dapatkan bonus slot generate.</div>
    <input class="popup-input" id="donate-amount" type="number" min="1000" step="1000" value="" placeholder="Nominal bebas (min Rp 1.000)" style="font-size:14px;height:42px" aria-label="Nominal Donate">
    <div class="popup-text" id="donate-bonus" style="font-weight:700;color:#059669">+1 slot generate</div>
    <div class="popup-actions" style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <button class="btn-skip" type="button" onclick="closePopup()">Batal</button>
      <button class="btn" type="button" onclick="createPayment()">Bayar QRIS</button>
    </div>
  </div>`
  popup.classList.add('show')
  document.getElementById('donate-amount').addEventListener('input', updateDonateBonus)
}
function updateDonateBonus() {
  const amount = parseInt(document.getElementById('donate-amount').value, 10) || 0
  const bonus = bonusForDonateAmount(amount)
  const el = document.getElementById('donate-bonus')
  if (el) el.textContent = bonus > 0 ? `+${bonus} slot generate` : ''
}
function setDonation(amount, extra) {
  window._donateAmount = amount
  window._donateExtra = extra
}
async function createPayment() {
  const amt = parseInt(document.getElementById('donate-amount')?.value, 10) || 1000
  const extra = bonusForDonateAmount(amt)
  try {
    trackSource('donate_create', '')
    const r = await fetch('/api/payment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', amount: amt, extra, device_id: getDeviceId() }) })
    const d = await r.json()
    if (d.url) {
      localStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify({ invoice: d.invoice, amount: amt }))
      pollPendingDonate(d.invoice)
      closePopup()
      window.open(d.url, '_blank')
    } else { alert(d.error || 'Gagal buat payment') }
  } catch { alert('Koneksi error') }
}
window.showPaymentPopup = showPaymentPopup
window.closePopup = closePopup
window.showDonate = showDonate
window.setDonation = setDonation
window.createPayment = createPayment
window.selectUnlockAmount = selectUnlockAmount
window.minimizeUnlock = minimizeUnlock
window.resumeUnlock = resumeUnlock
window.openPendingUnlock = openPendingUnlock
window.createUnlockPayment = createUnlockPayment
window.shareUnlockLink = shareUnlockLink

async function trackIncomingShare() {
  try {
    const params = new URLSearchParams(location.search)
    const token = params.get('share') || ''
    if (!token) return
    const source = params.get('share_source') || ''
    const suffix = source ? `&source=${encodeURIComponent(source)}` : ''
    await fetch(`/api/share?token=${encodeURIComponent(token)}&device_id=${encodeURIComponent(getDeviceId())}${suffix}`)
  } catch {}
}

resumeUnlock()
resumePendingDonate()
loadAccounts()
loadSlotInfo()
loadClosedMode()
seedHomepageStats()
loadHomepageStats()
trackIncomingShare()

function seedHomepageStats() {
  const totalEl = document.getElementById('hs-total')
  const successEl = document.getElementById('hs-success')
  if (totalEl) totalEl.textContent = String(1000 + Math.floor(Math.random() * 9000))
  if (successEl) successEl.textContent = String(500 + Math.floor(Math.random() * 4000))
}

async function loadHomepageStats() {
  const card = document.getElementById('homepage-stats')
  if (!card) return
  card.classList.add('show')
  try {
    const r = await fetch('/api/admin?public_stats=1')
    if (!r.ok) return
    const d = await r.json()
    animateStatValue(document.getElementById('hs-total'), d.total ?? 0)
    animateStatValue(document.getElementById('hs-success'), d.success ?? 0)
  } catch {}
}

function animateStatValue(el, finalValue) {
  if (!el) return
  const target = String(finalValue)
  let frame = 0
  const totalFrames = 14
  const timer = setInterval(() => {
    frame++
    if (frame >= totalFrames) {
      clearInterval(timer)
      el.textContent = target
      return
    }
    const random = target.split('').map(ch => /\d/.test(ch) ? Math.floor(Math.random() * 10) : ch).join('')
    el.textContent = random
  }, 45)
}

async function loadSlotInfo() {
  try {
    const r = await fetch('/api/payment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'status', device_id: getDeviceId() }) })
    const d = await r.json()
    const el = document.getElementById('slot-info')
    const count = document.getElementById('slot-count')
    const fill = document.getElementById('slot-fill')
    const txt = document.getElementById('slot-text')
    if (!el || !count || !fill || !txt) return
    if (d.limit > 0) {
      count.textContent = `${d.used} / ${d.limit}`
      fill.style.width = `${Math.min(100, Math.round((d.used / d.limit) * 100))}%`
      txt.textContent = d.remaining > 0 ? `Sisa ${d.remaining}x generate link.` : 'Slot habis. Donate untuk tambah slot.'
      el.style.display = 'block'
      if (d.remaining > 0) clearPendingUnlockUI()
    }
  } catch {}
}

async function loadAccounts() {
  const box = document.getElementById('accounts-box')
  if (!box) return
  box.innerHTML = `<div class="acc-title">${t('history')}</div><div class="acc-meta">Memuat riwayat...</div>`
  box.classList.add('show')
  try {
    const r = await fetch(`/api/accounts?device_id=${encodeURIComponent(getDeviceId())}`)
    const d = await r.json()
    if (!d.accounts || !d.accounts.length) { box.innerHTML = `<div class="acc-title">${t('history')}</div><div class="acc-meta">Belum ada riwayat.</div>`; box.classList.add('show'); return }
    box.innerHTML = `<div class="acc-title">${t('history')}</div>` + d.accounts.map(a => {
      const plan = a.plan_type === 'plus' ? 'Plus' : a.plan_type === 'pro' ? 'Pro' : a.plan_type === 'go' ? 'Go' : 'Free'
      const statusTxt = a.status === 'success' ? 'Link OK' : a.status === 'already_paid' ? 'Sudah aktif' : a.status
      const time = a.last_used ? new Date(a.last_used).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : '-'
      const action = a.can_regenerate ? `<button class="btn-copy" style="margin-top:8px;padding:6px 10px;font-size:11px;width:100%" onclick="regenerateAccount('${escapeHtml(a.email)}')">Regenerate</button>` : (a.checkout_url ? `<button class="btn-copy" style="margin-top:8px;padding:6px 10px;font-size:11px;width:100%" onclick="window.open('${a.checkout_url}','_blank')">Buka link</button>` : '')
      return `<div class="acc-row"><div><div style="font-size:12px;font-weight:600;color:#111">${escapeHtml(a.email)}</div><div style="font-size:10px;color:#999;margin-top:2px">${escapeHtml(plan)} · ${escapeHtml(statusTxt)} · ${escapeHtml(time)}</div></div>${action}</div>`
    }).join('')
    box.classList.add('show')
  } catch {}
}
