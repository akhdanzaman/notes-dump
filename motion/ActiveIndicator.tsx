import React from 'react';
import { motion } from 'motion/react';
import { motionTransition } from './transitions';

interface ActiveIndicatorProps {
  className: string;
  layoutId?: string;
}

const ActiveIndicator: React.FC<ActiveIndicatorProps> = ({
  className,
  layoutId = 'active-indicator',
}) => (
  <motion.span
    aria-hidden="true"
    layoutId={layoutId}
    className={className}
    transition={motionTransition.navigation}
  />
);

export default ActiveIndicator;
