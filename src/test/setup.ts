import '@testing-library/jest-dom/vitest';

// jsdom no implementa la captura de punteros: basta con que existan para los adaptadores.
if (!('setPointerCapture' in Element.prototype)) {
  const noop = (): undefined => undefined;
  Object.assign(Element.prototype, {
    setPointerCapture: noop,
    releasePointerCapture: noop,
    hasPointerCapture: (): boolean => false,
  });
}
