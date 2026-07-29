import React from 'react';
import { MotionConfig } from 'motion/react';
import { motionTransition } from './transitions';

const MotionProvider: React.FC<React.PropsWithChildren> = ({ children }) => (
  <MotionConfig reducedMotion="user" transition={motionTransition.standard}>
    {children}
  </MotionConfig>
);

export default MotionProvider;

