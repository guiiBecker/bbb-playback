import { useCallback, useEffect, useRef } from 'react';
import player from 'utils/player';

// How long a list stays where the user scrolled it before following again
const READING_PAUSE = 5000;

// Keys that scroll a list when it has the focus
const SCROLL_KEYS = ['ArrowDown', 'ArrowUp', 'End', 'Home', 'PageDown', 'PageUp', ' '];

// Puts the node a third of the way down the list, or at the top when it is too
// tall for that. Moves the list only: scrollIntoView would also scroll the page
// on narrow screens, where the panel sits below the player
const scrollWithin = (container, node) => {
  if (!container || !node) return;

  // The list is the nodes' offset parent (position: relative)
  const room = container.clientHeight / 3;
  const top = node.offsetTop - (node.offsetHeight > 2 * room ? 0 : room);
  const target = Math.max(0, Math.min(top, container.scrollHeight - container.clientHeight));
  if (Math.abs(container.scrollTop - target) > 1) {
    container.scrollTo({ behavior: 'smooth', top: target });
  }
};

// Keeps a list on its current item (the `data-id` equal to `currentId`) while
// the recording plays. Scrolling the list by hand pauses that for a while;
// seeking resumes it. Spread `listProps` on the scrolling element
const useFollow = (currentId) => {
  const list = useRef(null);
  // When the user last scrolled the list themselves. Only user input counts:
  // the list's own smooth scrolling fires scroll events too
  const readAt = useRef(0);

  const nodeOf = useCallback((id) => (list.current && id != null
    ? list.current.querySelector(`[data-id="${CSS.escape(String(id))}"]`)
    : null), []);

  const pause = useCallback(() => { readAt.current = Date.now(); }, []);

  useEffect(() => {
    if (currentId == null || Date.now() - readAt.current < READING_PAUSE) return;
    scrollWithin(list.current, nodeOf(currentId));
  }, [currentId, nodeOf]);

  // Seeking (an item's time, the timeline) is a request to follow again
  useEffect(() => {
    const p = player.primary;
    if (!p) return undefined;

    const follow = () => { readAt.current = 0; };
    p.on('seeking', follow);
    return () => { if (!p.isDisposed()) p.off('seeking', follow); };
  }, []);

  // Shows an item the user asked for, then leaves the list there for a while
  const reveal = useCallback((id) => {
    const node = nodeOf(id);
    if (!node) return null;

    pause();
    scrollWithin(list.current, node);
    return node;
  }, [nodeOf, pause]);

  const listProps = {
    onKeyDown: (event) => {
      if (SCROLL_KEYS.includes(event.key) && event.target === event.currentTarget) pause();
    },
    // Grabbing the scrollbar: the press lands on the list itself, not an item
    onPointerDown: (event) => {
      if (event.target === event.currentTarget) pause();
    },
    onTouchMove: pause,
    onWheel: pause,
    ref: list,
    tabIndex: 0,
  };

  return { listProps, reveal };
};

export { useFollow };
