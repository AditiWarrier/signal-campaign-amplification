import { useEffect } from 'react';
import { Platform } from 'react-native';

type ScrollHost = HTMLElement & {
  getScrollableNode?: () => HTMLElement;
};

export function useWebScrollDiagnostics(ref: { current: unknown }, screen: string) {
  useEffect(() => {
    if (!__DEV__ || Platform.OS !== 'web' || typeof window === 'undefined') return;

    const host = ref.current as ScrollHost | null;
    const node = host?.getScrollableNode?.() ?? host;
    if (!(node instanceof HTMLElement)) {
      console.info(`[SIGNAL scroll:${screen}] ScrollView DOM node unavailable`, { host });
      return;
    }

    const describe = (element: HTMLElement) => {
      const style = window.getComputedStyle(element);
      return {
        element: element.tagName.toLowerCase(),
        className: typeof element.className === 'string' ? element.className : '',
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        scrollTop: element.scrollTop,
        overflowY: style.overflowY,
        minHeight: style.minHeight,
        flex: style.flex,
      };
    };
    const ancestors: ReturnType<typeof describe>[] = [];
    let ancestor = node.parentElement;
    while (ancestor && ancestors.length < 6) {
      ancestors.push(describe(ancestor));
      ancestor = ancestor.parentElement;
    }

    const reportScroll = () => console.info(`[SIGNAL scroll:${screen}] position`, describe(node));
    const reportWheel = (event: WheelEvent) => console.info(`[SIGNAL wheel:${screen}]`, {
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      scrollTop: node.scrollTop,
    });

    console.info(`[SIGNAL scroll:${screen}] DOM`, {
      scrollElement: describe(node),
      ancestors,
    });
    node.addEventListener('scroll', reportScroll, { passive: true });
    node.addEventListener('wheel', reportWheel, { passive: true });

    return () => {
      node.removeEventListener('scroll', reportScroll);
      node.removeEventListener('wheel', reportWheel);
    };
  }, [ref, screen]);
}
