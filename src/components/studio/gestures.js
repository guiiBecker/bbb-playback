import { useEffect, useRef, useState } from 'react';
import { shortcuts } from 'config';
import { seek } from 'utils/actions';
import player from 'utils/player';

// The back and forward buttons' step
const { seconds: STEP } = shortcuts.seek;

// Two taps closer than this in time and space are a double tap
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_DISTANCE = 40;

// After a double tap, each further tap on the same side within this time
// seeks one more step, as in video apps
const CHAIN_MS = 700;

// Which half of the element a pointer event is on
const sideOf = (node, event) => {
  const rect = node.getBoundingClientRect();

  return event.clientX - rect.left < rect.width / 2 ? 'backward' : 'forward';
};

// Double tap on the left or right half of `ref`'s element seeks back or
// forward on touch screens. Returns the feedback to show: { side, total, id }
// while a run of taps lasts, null otherwise. Mouse and pen are left alone
const useDoubleTapSeek = (ref) => {
  const [feedback, setFeedback] = useState(null);
  const lastTap = useRef(null);
  const run = useRef(null);
  const hide = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const onPointerUp = (event) => {
      if (event.pointerType !== 'touch' || !player.primary) return;

      const side = sideOf(node, event);
      const now = event.timeStamp;
      const previous = lastTap.current;
      const chained = run.current && run.current.side === side && now < run.current.until;
      const doubled = previous && previous.side === side
        && now - previous.time < DOUBLE_TAP_MS
        && Math.hypot(event.clientX - previous.x, event.clientY - previous.y) < DOUBLE_TAP_DISTANCE;

      if (!chained && !doubled) {
        lastTap.current = {
          side,
          time: now,
          x: event.clientX,
          y: event.clientY,
        };
        run.current = null;
        return;
      }

      seek(side === 'forward' ? STEP : -STEP);
      const total = (chained ? run.current.total : 0) + STEP;
      run.current = { side, total, until: now + CHAIN_MS };
      lastTap.current = null;
      setFeedback({ id: now, side, total });

      clearTimeout(hide.current);
      hide.current = setTimeout(() => {
        run.current = null;
        setFeedback(null);
      }, CHAIN_MS);
    };

    // Capture: the whiteboard stops the pointer events on the slide
    node.addEventListener('pointerup', onPointerUp, true);

    return () => {
      node.removeEventListener('pointerup', onPointerUp, true);
      clearTimeout(hide.current);
    };
  }, [ref]);

  return feedback;
};

export { useDoubleTapSeek };
