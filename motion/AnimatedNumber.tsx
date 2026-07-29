import React, { useEffect, useRef } from 'react';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'motion/react';
import { motionSpring, motionTransition } from './transitions';

interface AnimatedNumberProps {
  value: number;
  formatter?: (value: number) => string;
  hidden?: boolean;
  hiddenLabel?: string;
  className?: string;
  ariaLabel?: string;
}

const defaultNumberFormatter = new Intl.NumberFormat('id-ID', {
  maximumFractionDigits: 0,
});

const defaultFormatter = (value: number) =>
  defaultNumberFormatter.format(Math.round(value));

const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  formatter = defaultFormatter,
  hidden = false,
  hiddenLabel = '••••',
  className = '',
  ariaLabel,
}) => {
  const reduceMotion = useReducedMotion();
  const formatterRef = useRef(formatter);
  formatterRef.current = formatter;

  const source = useMotionValue(value);
  const animated = useSpring(source, motionSpring.gentle);
  const display = useTransform(animated, (latest) => formatterRef.current(latest));

  useEffect(() => {
    if (hidden || reduceMotion) {
      source.jump(value);
      animated.jump(value);
      return;
    }
    source.set(value);
  }, [animated, hidden, reduceMotion, source, value]);

  const accessibleLabel = hidden
    ? ariaLabel
      ? `${ariaLabel}: nilai disembunyikan`
      : 'Nilai disembunyikan'
    : ariaLabel
      ? `${ariaLabel}: ${formatter(value)}`
      : formatter(value);

  return (
    <span className={`inline-grid ${className}`.trim()} aria-label={accessibleLabel}>
      {hidden ? (
        <span aria-hidden="true" className="col-start-1 row-start-1">
          {hiddenLabel}
        </span>
      ) : (
        <motion.span
          key="visible"
          aria-hidden="true"
          className="col-start-1 row-start-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={motionTransition.fast}
        >
          {display}
        </motion.span>
      )}
    </span>
  );
};

export default AnimatedNumber;
