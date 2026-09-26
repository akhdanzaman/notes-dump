import type { Transition } from 'motion/react';

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
  page: 8,
} as const;

export const motionStagger = {
  tight: 0.03,
  normal: 0.045,
  dashboard: 0.05,
} as const;

export const motionSpring = {
  button: {
    type: 'spring',
    stiffness: 520,
    damping: 34,
    mass: 0.45,
  },
  selection: {
    type: 'spring',
    stiffness: 430,
    damping: 38,
    mass: 0.7,
  },
  layout: {
    type: 'spring',
    stiffness: 360,
    damping: 36,
    mass: 0.8,
  },
  gentle: {
    type: 'spring',
    stiffness: 210,
    damping: 30,
    mass: 0.9,
  },
} as const satisfies Record<string, Transition>;

export const motionTransition = {
  instant: {
    duration: motionDuration.instant,
  },
  fast: {
    duration: motionDuration.fast,
    ease: motionEasing.standard,
  },
  navigation: {
    duration: 0.16,
    ease: motionEasing.standard,
  },
  standard: {
    duration: motionDuration.normal,
    ease: motionEasing.standard,
  },
  enter: {
    duration: 0.22,
    ease: motionEasing.enter,
  },
  exit: {
    duration: 0.17,
    ease: motionEasing.exit,
  },
  panelExit: {
    duration: 0.2,
    ease: motionEasing.exit,
  },
  modal: {
    duration: 0.24,
    ease: motionEasing.emphasize,
  },
  page: {
    duration: motionDuration.deliberate,
    ease: motionEasing.emphasize,
  },
} as const satisfies Record<string, Transition>;
