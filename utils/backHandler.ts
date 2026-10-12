type Handler = () => boolean;
const handlers: Handler[] = [];

export const BackHandler = {
  register: (handler: Handler) => {
    handlers.push(handler);
    return () => {
      const idx = handlers.indexOf(handler);
      if (idx > -1) handlers.splice(idx, 1);
    };
  },
  handle: () => {
    // Active dialogs own browser/device Back too, including the dirty-draft guard.
    if (typeof window !== 'undefined' && !window.dispatchEvent(new Event('arkaiv-panel-back', { cancelable: true }))) return true;
    for (let i = handlers.length - 1; i >= 0; i--) {
      if (handlers[i]()) return true;
    }
    return false;
  }
};
