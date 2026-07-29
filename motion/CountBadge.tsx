import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { popVariants } from './variants';

interface CountBadgeProps {
  count: number;
  className: string;
  max?: number;
  ariaLabel?: string;
}

const CountBadge: React.FC<CountBadgeProps> = ({
  count,
  className,
  max = 9,
  ariaLabel,
}) => {
  const previousCountRef = useRef(count);
  const increased = count > previousCountRef.current;

  useEffect(() => {
    previousCountRef.current = count;
  }, [count]);

  return (
    <AnimatePresence initial={false} mode="popLayout">
      {count > 0 && (
        <motion.span
          key={count}
          variants={popVariants}
          initial={increased ? 'hidden' : false}
          animate="visible"
          exit="exit"
          className={className}
          aria-label={ariaLabel || `${count} item memerlukan perhatian`}
        >
          {count > max ? `${max}+` : count}
        </motion.span>
      )}
    </AnimatePresence>
  );
};

export default CountBadge;

