import type { ThemeMode } from '@/lib/theme'

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void | Promise<void>) => {
    ready: Promise<void>
    finished: Promise<void>
  }
}

type ThemeModeSetter = (theme: ThemeMode) => void
type ThemeSwitchDirection = 'down' | 'up'

let previousThemeSwitchDirection: ThemeSwitchDirection = 'up'

function getNextThemeSwitchDirection(): ThemeSwitchDirection {
  previousThemeSwitchDirection = previousThemeSwitchDirection === 'down' ? 'up' : 'down'
  return previousThemeSwitchDirection
}

function getThemeSwitchClipPath(direction: ThemeSwitchDirection) {
  return direction === 'down'
    ? ['inset(0 0 100% 0)', 'inset(0 0 0 0)']
    : ['inset(100% 0 0 0)', 'inset(0 0 0 0)']
}

export function applyThemeModeImmediately(mode: ThemeMode, setTheme: ThemeModeSetter) {
  setTheme(mode)
  if (typeof document === 'undefined') return

  const root = document.documentElement
  if (mode === 'dark') {
    root.classList.add('dark')
    return
  }
  if (mode === 'light') {
    root.classList.remove('dark')
    return
  }

  const prefersDark =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  root.classList.toggle('dark', prefersDark)
}

export async function applyThemeModeWithTransition(
  mode: ThemeMode,
  setTheme: ThemeModeSetter,
) {
  if (typeof document === 'undefined') {
    setTheme(mode)
    return
  }

  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const doc = document as ViewTransitionDocument
  const transitionApi = doc.startViewTransition

  if (!transitionApi || reduceMotion) {
    applyThemeModeImmediately(mode, setTheme)
    return
  }

  const root = document.documentElement
  const direction = getNextThemeSwitchDirection()
  const transition = transitionApi.call(doc, () => {
    applyThemeModeImmediately(mode, setTheme)
  })

  try {
    await transition.ready
    root.dataset.themeSwitch = 'active'
    root.dataset.themeSwitchDirection = direction

    const animation = root.animate(
      {
        clipPath: getThemeSwitchClipPath(direction),
      },
      {
        duration: 1400,
        easing: 'cubic-bezier(0.22, 0.72, 0.18, 1)',
        pseudoElement: '::view-transition-new(root)',
      },
    )

    await animation.finished.catch(() => undefined)
  } finally {
    delete root.dataset.themeSwitch
    delete root.dataset.themeSwitchDirection
  }
}
