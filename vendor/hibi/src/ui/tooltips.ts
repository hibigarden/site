export type TooltipOptions = {
  anchor: HTMLElement | SVGElement
  text: string
  placement?: 'top' | 'bottom'
}
export type TooltipApi = {
  /** Show plain text next to an element; the returned function hides only this tooltip. */
  show: (options: TooltipOptions) => () => void
  hide: () => void
}
