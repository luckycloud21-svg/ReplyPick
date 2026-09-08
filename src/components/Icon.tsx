import type { ReactElement } from 'react'

type IconName = 'arrow-left' | 'arrow-right' | 'check' | 'chevron-down' | 'clock' | 'copy' | 'heart' | 'home' | 'info' | 'message' | 'more' | 'refresh' | 'send' | 'settings' | 'spark' | 'star' | 'trash' | 'warning' | 'x'

const paths: Record<IconName, ReactElement> = {
  'arrow-left': <path d="m15 18-6-6 6-6" />,
  'arrow-right': <path d="m9 18 6-6-6-6" />,
  check: <path d="m5 12 4 4L19 6" />,
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></>,
  copy: <><rect x="8" y="8" width="10" height="10" rx="2" /><path d="M16 8V6.5A1.5 1.5 0 0 0 14.5 5h-8A1.5 1.5 0 0 0 5 6.5v8A1.5 1.5 0 0 0 6.5 16H8" /></>,
  heart: <path d="M20.4 8.7c0 5.2-8.4 9.5-8.4 9.5s-8.4-4.3-8.4-9.5C3.6 6.6 5 5 7.3 5c1.5 0 2.8.8 3.7 2 0.9-1.2 2.2-2 3.7-2 2.3 0 5.7 1.6 5.7 3.7Z" />,
  home: <><path d="m4 10 8-6 8 6v9H4z" /><path d="M9 19v-5h6v5" /></>,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8h.01" /></>,
  message: <><path d="M19 5H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3l4 3 4-3h3a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Z" /><path d="M7 10h10M7 13h6" /></>,
  more: <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></>,
  refresh: <><path d="M19 8a7.5 7.5 0 0 0-13.5 2M5 8v4h4M5 16a7.5 7.5 0 0 0 13.5-2M19 16v-4h-4" /></>,
  send: <><path d="m21 3-7.3 18-3.8-7L3 10.2 21 3Z" /><path d="M10 14 21 3" /></>,
  settings: <><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" /><path d="m19.4 15 .1.1a1.8 1.8 0 0 1-2.5 2.5l-.1-.1a1.8 1.8 0 0 0-3.1 1.3v.2a1.8 1.8 0 0 1-3.6 0v-.2a1.8 1.8 0 0 0-3.1-1.3l-.1.1a1.8 1.8 0 0 1-2.5-2.5l.1-.1A1.8 1.8 0 0 0 3.4 12a1.8 1.8 0 0 1 0-3.6h.2a1.8 1.8 0 0 0 1.3-3.1l-.1-.1a1.8 1.8 0 0 1 2.5-2.5l.1.1A1.8 1.8 0 0 0 10.5 1.5h.2a1.8 1.8 0 0 1 3.6 0v.2a1.8 1.8 0 0 0 3.1 1.3l.1-.1a1.8 1.8 0 0 1 2.5 2.5l-.1.1a1.8 1.8 0 0 0 1.3 3.1h.2a1.8 1.8 0 0 1 0 3.6h-.2a1.8 1.8 0 0 0-1.3 3.1Z" transform="scale(.72) translate(4.7 4.7)" /></>,
  spark: <path d="m12 3 1.3 5.7L19 10l-5.7 1.3L12 17l-1.3-5.7L5 10l5.7-1.3L12 3ZM19 16l.6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6L19 16Z" />,
  star: <path d="m12 4 2.5 5.1 5.5.8-4 4 1 5.5-5-2.6-5 2.6 1-5.5-4-4 5.5-.8L12 4Z" />,
  trash: <><path d="M5 7h14M10 11v5M14 11v5M9 7V5h6v2M7 7l.8 12h8.4L17 7" /></>,
  warning: <><path d="m12 4 8 15H4L12 4Z" /><path d="M12 9v4M12 16h.01" /></>,
  x: <path d="m6 6 12 12M18 6 6 18" />,
}

export function Icon({ name, size = 20, strokeWidth = 1.8 }: { name: IconName; size?: number; strokeWidth?: number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}
