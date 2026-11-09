import "@testing-library/jest-dom/vitest";

// jsdom does not implement scrollIntoView, which the chat list uses to keep
// the newest message in view.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
