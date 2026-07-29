export const motionDuration = {
  instant: 0,
  fast: 0.14,
  normal: 0.22,
  deliberate: 0.26,
} as const;

export const motionEasing = {
  enter: [0.16, 1, 0.3, 1] as [number, number, number, number],
  exit: [0.4, 0, 1, 1] as [number, number, number, number],
  standard: [0.2, 0, 0, 1] as [number, number, number, number],
  emphasize: [0.22, 1, 0.36, 1] as [number, number, number, number],
} as const;

export const motionDistance = {
  micro: 4,
  component: 10,
  panel: 20,
  page: 28,
} as const;

export const motionStagger = {
  tight: 0.03,
  normal: 0.045,
  dashboard: 0.05,
} as const;
