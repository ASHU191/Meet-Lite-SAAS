export function createVolumeMeter(stream: MediaStream) {
  const AudioContextCtor = (globalThis as any).AudioContext || (globalThis as any).webkitAudioContext
  if (!AudioContextCtor) return null

  const ctx = new AudioContextCtor()
  const source = ctx.createMediaStreamSource(stream)
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 256
  const dataArray = new Uint8Array(analyser.frequencyBinCount)
  source.connect(analyser)

  function getVolume(): number {
    analyser.getByteFrequencyData(dataArray)
    let sum = 0
    for (let i = 0; i < dataArray.length; i++) sum += dataArray[i]
    return sum / dataArray.length
  }

  return { ctx, analyser, getVolume, dispose: () => ctx.close().catch(() => {}) }
}
