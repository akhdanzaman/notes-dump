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
    for (let i = handlers.length - 1; i >= 0; i--) {
      if (handlers[i]()) return true;
    }
    return false;
  }
};
