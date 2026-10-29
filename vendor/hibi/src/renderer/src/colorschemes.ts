import { createColorschemeStore } from '../../ui/colorschemes'

export const colorschemes = createColorschemeStore('hibi-colorscheme')
let nativeSignature = ''
const sync = () => {
  const appearance = colorschemes.native()
  const signature = JSON.stringify(appearance)
  if (signature === nativeSignature) return
  nativeSignature = signature
  void window.hibi.setAppearance(appearance).catch((error) => {
    nativeSignature = ''
    console.error('could not persist native appearance:', error)
  })
}
const unsubscribe = colorschemes.subscribe(sync)
colorschemes.start()
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    unsubscribe()
    colorschemes.stop()
  })
