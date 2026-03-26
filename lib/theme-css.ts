export type ThemePreset = 
  | 'basic' 
  | 'midnight' 
  | 'forest' 
  | 'sakura' 
  | 'obsidian' 
  | 'ocean' 
  | 'amber' 
  | 'lavender'
  | 'mono'
  | 'nord'

export function getThemePresetCss(presetRaw: string | null | undefined): string {
  const preset = (presetRaw || 'basic') as ThemePreset

  // Midnight - 深邃蓝紫夜空，适合深夜使用
  if (preset === 'midnight') {
    return `
:root {
  --background: oklch(0.14 0.015 270);
  --foreground: oklch(0.92 0.01 270);
  --card: oklch(0.18 0.02 270);
  --primary: oklch(0.7 0.15 270);
  --accent: oklch(0.65 0.12 300);
  --border: oklch(0.28 0.025 270);
  --muted-foreground: oklch(0.65 0.02 270);
  --online: oklch(0.72 0.18 160);
}
.animated-bg {
  background:
    radial-gradient(ellipse 80% 60% at 50% -30%, oklch(0.35 0.12 280 / 0.4), transparent),
    radial-gradient(ellipse 60% 50% at 100% 100%, oklch(0.3 0.1 300 / 0.3), transparent),
    radial-gradient(ellipse 50% 40% at 0% 80%, oklch(0.32 0.08 250 / 0.25), transparent);
}
`
  }

  // Forest - 清新自然绿，护眼舒适
  if (preset === 'forest') {
    return `
:root {
  --background: oklch(0.97 0.015 145);
  --foreground: oklch(0.22 0.04 145);
  --card: oklch(0.99 0.01 145);
  --primary: oklch(0.5 0.14 150);
  --accent: oklch(0.6 0.1 130);
  --border: oklch(0.86 0.03 145);
  --muted-foreground: oklch(0.5 0.04 145);
  --online: oklch(0.58 0.16 145);
}
.animated-bg {
  background:
    radial-gradient(ellipse 70% 50% at 30% 0%, oklch(0.85 0.08 145 / 0.3), transparent),
    radial-gradient(ellipse 50% 40% at 90% 80%, oklch(0.8 0.06 130 / 0.2), transparent);
}
`
  }

  // Sakura - 柔和樱花粉，温馨浪漫
  if (preset === 'sakura') {
    return `
:root {
  --background: oklch(0.98 0.012 15);
  --foreground: oklch(0.25 0.03 15);
  --card: oklch(0.995 0.008 15);
  --primary: oklch(0.65 0.15 10);
  --accent: oklch(0.72 0.1 350);
  --border: oklch(0.9 0.02 15);
  --muted-foreground: oklch(0.55 0.04 15);
  --online: oklch(0.62 0.16 150);
}
.animated-bg {
  background:
    radial-gradient(ellipse 60% 50% at 20% 10%, oklch(0.88 0.1 10 / 0.25), transparent),
    radial-gradient(ellipse 50% 40% at 80% 90%, oklch(0.85 0.08 350 / 0.2), transparent);
}
`
  }

  // Obsidian - 纯黑极简，专注内容（类似 Paco Coursey 风格）
  if (preset === 'obsidian') {
    return `
:root {
  --background: oklch(0.12 0 0);
  --foreground: oklch(0.88 0 0);
  --card: oklch(0.15 0 0);
  --primary: oklch(0.85 0 0);
  --accent: oklch(0.7 0 0);
  --border: oklch(0.25 0 0);
  --muted-foreground: oklch(0.55 0 0);
  --online: oklch(0.7 0.16 145);
}
.animated-bg {
  background: oklch(0.12 0 0);
}
`
  }

  // Ocean - 深海蓝绿渐变，沉稳专业（类似 Brittany Chiang 风格）
  if (preset === 'ocean') {
    return `
:root {
  --background: oklch(0.18 0.025 220);
  --foreground: oklch(0.9 0.01 200);
  --card: oklch(0.22 0.03 220);
  --primary: oklch(0.75 0.14 180);
  --accent: oklch(0.7 0.1 200);
  --border: oklch(0.3 0.03 220);
  --muted-foreground: oklch(0.6 0.03 200);
  --online: oklch(0.75 0.16 175);
}
.animated-bg {
  background:
    radial-gradient(ellipse 80% 60% at 0% 0%, oklch(0.28 0.06 200 / 0.5), transparent),
    radial-gradient(ellipse 60% 50% at 100% 80%, oklch(0.25 0.05 180 / 0.4), transparent),
    linear-gradient(135deg, oklch(0.16 0.02 230) 0%, oklch(0.2 0.03 210) 100%);
}
`
  }

  // Amber - 温暖琥珀，复古怀旧
  if (preset === 'amber') {
    return `
:root {
  --background: oklch(0.96 0.02 70);
  --foreground: oklch(0.25 0.04 50);
  --card: oklch(0.98 0.015 70);
  --primary: oklch(0.6 0.15 55);
  --accent: oklch(0.7 0.12 40);
  --border: oklch(0.88 0.04 70);
  --muted-foreground: oklch(0.5 0.05 60);
  --online: oklch(0.65 0.16 145);
}
.animated-bg {
  background:
    radial-gradient(ellipse 70% 50% at 80% 20%, oklch(0.9 0.08 55 / 0.3), transparent),
    radial-gradient(ellipse 50% 40% at 10% 80%, oklch(0.88 0.06 70 / 0.25), transparent);
}
`
  }

  // Lavender - 淡雅薰衣草，清新优雅
  if (preset === 'lavender') {
    return `
:root {
  --background: oklch(0.97 0.015 290);
  --foreground: oklch(0.25 0.03 290);
  --card: oklch(0.99 0.01 290);
  --primary: oklch(0.58 0.14 290);
  --accent: oklch(0.7 0.1 310);
  --border: oklch(0.88 0.025 290);
  --muted-foreground: oklch(0.52 0.04 290);
  --online: oklch(0.65 0.16 150);
}
.animated-bg {
  background:
    radial-gradient(ellipse 60% 50% at 70% 10%, oklch(0.88 0.08 290 / 0.25), transparent),
    radial-gradient(ellipse 50% 40% at 20% 80%, oklch(0.85 0.06 310 / 0.2), transparent);
}
`
  }

  // Mono - 纯净白色极简（类似 Lorenz Woehr 风格）
  if (preset === 'mono') {
    return `
:root {
  --background: oklch(0.995 0 0);
  --foreground: oklch(0.15 0 0);
  --card: oklch(0.98 0 0);
  --primary: oklch(0.2 0 0);
  --accent: oklch(0.4 0 0);
  --border: oklch(0.9 0 0);
  --muted-foreground: oklch(0.5 0 0);
  --online: oklch(0.55 0.14 145);
}
.animated-bg {
  background: oklch(0.995 0 0);
}
`
  }

  // Nord - 北欧风格，冷静淡雅
  if (preset === 'nord') {
    return `
:root {
  --background: oklch(0.25 0.02 230);
  --foreground: oklch(0.92 0.01 220);
  --card: oklch(0.28 0.025 230);
  --primary: oklch(0.72 0.1 210);
  --accent: oklch(0.7 0.08 180);
  --border: oklch(0.35 0.025 230);
  --muted-foreground: oklch(0.65 0.02 220);
  --online: oklch(0.72 0.14 145);
}
.animated-bg {
  background:
    radial-gradient(ellipse 70% 50% at 50% -20%, oklch(0.35 0.05 210 / 0.3), transparent),
    radial-gradient(ellipse 50% 40% at 0% 100%, oklch(0.32 0.04 180 / 0.25), transparent);
}
`
  }

  // basic: keep default CSS as-is.
  return ''
}

export function normalizeCustomCss(input: unknown): string {
  const value = String(input ?? '')
  // Keep overrides bounded to avoid accidental huge payloads.
  return value.slice(0, 20000)
}
