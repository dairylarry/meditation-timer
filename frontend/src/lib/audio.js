let ctx = null
let silentOsc = null

export function getOrCreateContext() {
  if (!ctx || ctx.state === 'closed') {
    ctx = new AudioContext()
  }
  if (ctx.state === 'suspended') {
    ctx.resume()
  }
  return ctx
}

export function startKeepalive(audioCtx) {
  if (silentOsc) return
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.connect(gain)
  gain.connect(audioCtx.destination)
  gain.gain.value = 0.00001
  osc.frequency.value = 1 // sub-audible frequency
  osc.start()
  silentOsc = osc
}

export function stopKeepalive() {
  if (silentOsc) {
    try { silentOsc.stop() } catch (_) {}
    silentOsc = null
  }
}

export function closeContext() {
  if (ctx) {
    ctx.close()
    ctx = null
  }
}

export async function loadGong(audioCtx, url) {
  const response = await fetch(url)
  const arrayBuffer = await response.arrayBuffer()
  return audioCtx.decodeAudioData(arrayBuffer)
}

export function playBuffer(audioCtx, buffer, volume = 1.0) {
  const source = audioCtx.createBufferSource()
  const gain = audioCtx.createGain()
  source.buffer = buffer
  gain.gain.value = volume
  source.connect(gain)
  gain.connect(audioCtx.destination)
  source.start()
}
