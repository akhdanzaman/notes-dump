import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { motionTransition } from './transitions';

interface AnimatedProgressProps {
  value: number;
  className?: string;
  label?: string;
}

const AnimatedProgress: React.FC<AnimatedProgressProps> = ({
  value,
  className = '',
  label,
}) => {
  const reduceMotion = useReducedMotion();
  const progress = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));

  return (
    <motion.div
      role={label ? 'progressbar' : undefined}
      aria-label={label}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
      aria-valuenow={label ? Math.round(progress) : undefined}
      className={`h-full w-full origin-left ${className}`.trim()}
      initial={false}
      animate={{ scaleX: progress / 100 }}
      transition={reduceMotion ? motionTransition.instant : motionTransition.standard}
    />
  );
};

export default AnimatedProgress;

