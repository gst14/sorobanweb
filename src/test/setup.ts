import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Sin `globals: true`, RTL no desmonta solo entre tests.
afterEach(() => {
  cleanup();
});

// jsdom no implementa la captura de punteros: basta con que existan para los adaptadores.
if (!('setPointerCapture' in Element.prototype)) {
  const noop = (): undefined => undefined;
  Object.assign(Element.prototype, {
    setPointerCapture: noop,
    releasePointerCapture: noop,
    hasPointerCapture: (): boolean => false,
  });
}

// jsdom no trae canvas: `getContext` devuelve null como siempre, pero sin el aviso en cada test.
// Los tests que dibujan lo reemplazan con un contexto falso.
HTMLCanvasElement.prototype.getContext = () => null;
