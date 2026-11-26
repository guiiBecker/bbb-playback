import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

const NAVIGATION_KEYS = ['ArrowDown', 'ArrowUp', 'End', 'Home'];

// A button that opens a short list of choices (a disclosure): the choices are
// plain buttons, the current one pressed. Opening gives the focus to the
// current choice, so arrows and Enter work right away. Escape, a press
// outside or tabbing away closes the list; arrows, Home and End move within
// it. `root` goes on the element around the button and the list, with
// `onBlur` and `onKeyDown`; `button` and `list` on those two, `id` on the list
const useDisclosure = () => {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const button = useRef(null);
  const list = useRef(null);
  const id = useId();

  // After a choice or Escape: back to the button
  const close = useCallback(() => {
    setOpen(false);
    if (button.current) button.current.focus();
  }, []);

  const toggle = useCallback(() => setOpen((shown) => !shown), []);

  useEffect(() => {
    if (!open) return undefined;

    const items = list.current ? [...list.current.querySelectorAll('button')] : [];
    const current = items.find((item) => item.getAttribute('aria-pressed') === 'true') || items[0];
    if (current) current.focus();

    const outside = (event) => {
      if (root.current && !root.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);

    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  const onKeyDown = (event) => {
    if (!open) return;

    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
      return;
    }

    if (!NAVIGATION_KEYS.includes(event.key) || !list.current) return;

    const items = [...list.current.querySelectorAll('button')];
    const index = items.indexOf(document.activeElement);
    const last = items.length - 1;
    const next = {
      ArrowDown: index < last ? index + 1 : 0,
      ArrowUp: index > 0 ? index - 1 : last,
      End: last,
      Home: 0,
    }[event.key];

    event.preventDefault();
    items[next].focus();
  };

  // Tabbing out closes. Only when the focus goes somewhere: Safari does not
  // focus buttons on click, there the press outside does it
  const onBlur = (event) => {
    if (open && event.relatedTarget && !root.current.contains(event.relatedTarget)) setOpen(false);
  };

  return {
    button,
    close,
    id,
    list,
    onBlur,
    onKeyDown,
    open,
    root,
    toggle,
  };
};

export { useDisclosure };
