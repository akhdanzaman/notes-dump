import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AnimatedNumber from '../AnimatedNumber';
import PresencePanel from '../PresencePanel';
import { motionDuration, motionStagger } from '../config';
import { motionTransition } from '../transitions';
import { errorNudgeVariants } from '../variants';

test('AnimatedNumber removes a hidden value from rendered markup immediately', () => {
  const markup = renderToStaticMarkup(
    React.createElement(AnimatedNumber, {
      value: 987654321,
      formatter: (value) => `SECRET-${value}`,
      hidden: true,
      hiddenLabel: 'PRIVATE',
      ariaLabel: 'Net worth',
    }),
  );

  assert.doesNotMatch(markup, /SECRET|987654321/);
  assert.match(markup, /PRIVATE/);
  assert.match(markup, /Net worth: nilai disembunyikan/);
});

test('AnimatedNumber accessible label combines context and formatted value', () => {
  const markup = renderToStaticMarkup(
    React.createElement(AnimatedNumber, {
      value: 42,
      formatter: (value) => `IDR-${value}`,
      ariaLabel: 'Total expense',
    }),
  );

  assert.match(markup, /aria-label="Total expense: IDR-42"/);
});

test('PresencePanel exposes dialog semantics only while open', () => {
  const closedMarkup = renderToStaticMarkup(
    React.createElement(
      PresencePanel,
      {
        isOpen: false,
        onClose: () => undefined,
        overlayClassName: 'overlay',
        panelClassName: 'panel',
        ariaLabel: 'Review Center',
        children: 'Review content',
      },
    ),
  );
  assert.equal(closedMarkup, '');

  const openMarkup = renderToStaticMarkup(
    React.createElement(
      PresencePanel,
      {
        isOpen: true,
        onClose: () => undefined,
        overlayClassName: 'overlay',
        panelClassName: 'panel',
        ariaLabel: 'Review Center',
        children: 'Review content',
      },
    ),
  );
  assert.match(openMarkup, /role="dialog"/);
  assert.match(openMarkup, /aria-modal="true"/);
  assert.match(openMarkup, /aria-label="Review Center"/);
});

test('motion timing tokens stay within the product timing envelope', () => {
  assert.ok(motionDuration.fast >= 0.12 && motionDuration.fast <= 0.18);
  assert.ok(motionDuration.normal >= 0.18 && motionDuration.normal <= 0.26);
  assert.ok(motionDuration.deliberate >= 0.18 && motionDuration.deliberate <= 0.26);
  assert.ok(
    motionTransition.navigation.duration >= 0.12 &&
      motionTransition.navigation.duration <= 0.18,
  );
  assert.ok(motionTransition.exit.duration >= 0.12 && motionTransition.exit.duration <= 0.18);
  assert.ok(motionTransition.enter.duration >= 0.18 && motionTransition.enter.duration <= 0.26);
  assert.ok(motionTransition.modal.duration >= 0.18 && motionTransition.modal.duration <= 0.26);
  assert.ok(
    motionTransition.panelExit.duration >= 0.18 &&
      motionTransition.panelExit.duration <= 0.26,
  );
  assert.ok(motionTransition.page.duration >= 0.18 && motionTransition.page.duration <= 0.26);
  assert.ok(motionStagger.tight >= 0.025 && motionStagger.tight <= 0.055);
  assert.ok(motionStagger.dashboard >= 0.025 && motionStagger.dashboard <= 0.055);
});

test('error feedback never uses a repeated lateral shake', () => {
  const visible = errorNudgeVariants.visible;
  assert.equal(typeof visible, 'object');
  assert.equal(visible && 'x' in visible ? visible.x : undefined, 0);
});
