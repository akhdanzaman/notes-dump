import type { Transition } from 'motion/react';
import { motionDuration, motionEasing } from './config';

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
