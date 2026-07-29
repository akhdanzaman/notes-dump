import type { Variants } from 'motion/react';
import { motionDistance, motionStagger } from './config';
import { motionSpring, motionTransition } from './transitions';

export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: motionTransition.standard },
  exit: { opacity: 0, transition: motionTransition.exit },
};

export const riseVariants: Variants = {
  hidden: { opacity: 0, y: motionDistance.component },
  visible: { opacity: 1, y: 0, transition: motionTransition.enter },
  exit: { opacity: 0, y: motionDistance.micro, transition: motionTransition.exit },
};

export const scaleVariants: Variants = {
  hidden: { opacity: 0, scale: 0.98 },
  visible: { opacity: 1, scale: 1, transition: motionTransition.enter },
  exit: { opacity: 0, scale: 0.985, transition: motionTransition.exit },
};

export const popVariants: Variants = {
  hidden: { opacity: 0, scale: 0.82 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: motionSpring.button,
  },
  exit: { opacity: 0, scale: 0.9, transition: motionTransition.exit },
};

export const collapseVariants: Variants = {
  hidden: { opacity: 0, gridTemplateRows: '0fr' },
  visible: {
    opacity: 1,
    gridTemplateRows: '1fr',
    transition: {
      gridTemplateRows: motionTransition.standard,
      opacity: motionTransition.fast,
    },
  },
  exit: {
    opacity: 0,
    gridTemplateRows: '0fr',
    transition: {
      gridTemplateRows: motionTransition.exit,
      opacity: { duration: 0.1 },
    },
  },
};

export const backdropVariants: Variants = {
  hidden: { opacity: 0, pointerEvents: 'none' },
  visible: {
    opacity: 1,
    pointerEvents: 'auto',
    transition: motionTransition.standard,
  },
  exit: {
    opacity: 0,
    pointerEvents: 'none',
    transition: motionTransition.exit,
  },
};

export const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.975, y: motionDistance.component },
  visible: { opacity: 1, scale: 1, y: 0, transition: motionTransition.modal },
  exit: {
    opacity: 0,
    scale: 0.985,
    y: motionDistance.micro,
    transition: motionTransition.exit,
  },
};

export const formModalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.985 },
  visible: { opacity: 1, scale: 1, transition: motionTransition.standard },
  exit: { opacity: 0, scale: 0.99, transition: motionTransition.exit },
};

export const sheetVariants: Variants = {
  hidden: { opacity: 0, y: motionDistance.panel },
  visible: { opacity: 1, y: 0, transition: motionTransition.modal },
  exit: { opacity: 0, y: motionDistance.panel, transition: motionTransition.exit },
};

export const listItemVariants: Variants = {
  hidden: { opacity: 0, y: motionDistance.component },
  visible: { opacity: 1, y: 0, transition: motionTransition.enter },
  exit: { opacity: 0, y: -motionDistance.micro, transition: motionTransition.exit },
};

export const highlightedListItemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: motionDistance.component,
    backgroundColor: 'rgba(99, 102, 241, 0.14)',
  },
  visible: {
    opacity: 1,
    y: 0,
    backgroundColor: 'rgba(99, 102, 241, 0)',
    transition: {
      ...motionTransition.enter,
      backgroundColor: { duration: 0.9, ease: motionTransition.standard.ease },
    },
  },
  exit: { opacity: 0, y: -motionDistance.micro, transition: motionTransition.exit },
};

export const directionalLabelVariants: Variants = {
  hidden: (direction: number = 0) => ({
    opacity: 0,
    x: direction === 0 ? 0 : direction * motionDistance.component,
  }),
  visible: {
    opacity: 1,
    x: 0,
    transition: motionTransition.standard,
  },
  exit: (direction: number = 0) => ({
    opacity: 0,
    x: direction === 0 ? 0 : direction * -motionDistance.component,
    transition: motionTransition.exit,
  }),
};

export const budgetThresholdVariants: Variants = {
  hidden: { opacity: 0, scale: 0.98 },
  visible: {
    opacity: [0, 0.75, 0],
    scale: [0.98, 1.025, 1],
    transition: { duration: 0.52, ease: motionTransition.standard.ease },
  },
};

export const staggerContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: motionStagger.tight,
      delayChildren: 0.02,
    },
  },
  exit: {
    transition: {
      staggerChildren: 0.02,
      staggerDirection: -1,
    },
  },
};

export const dashboardContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: motionStagger.dashboard,
      delayChildren: 0.04,
    },
  },
};

export const primaryPageVariants: Variants = {
  hidden: (direction: number = 0) => ({
    opacity: 0,
    x: direction === 0 ? 0 : direction * motionDistance.page,
  }),
  visible: {
    opacity: 1,
    x: 0,
    transition: motionTransition.page,
  },
  exit: (direction: number = 0) => ({
    opacity: 0,
    x: direction === 0 ? 0 : direction * -motionDistance.panel,
    transition: motionTransition.exit,
  }),
};

export const reducedPageVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: motionTransition.fast },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

export const reducedModalVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: motionTransition.fast },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

export const errorNudgeVariants: Variants = {
  hidden: { opacity: 0, x: 0 },
  visible: {
    opacity: 1,
    x: [0, -3, 2, 0],
    transition: {
      opacity: motionTransition.fast,
      x: { duration: 0.22, ease: motionTransition.standard.ease },
    },
  },
  exit: { opacity: 0, transition: motionTransition.exit },
};
