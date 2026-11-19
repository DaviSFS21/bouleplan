import { afterEach, describe, expect, it } from 'vitest';
import { focusIsLost } from './focus-lost';

afterEach(() => {
  document.body.replaceChildren();
});

describe('focusIsLost', () => {
  it('is true on the body and false on a live control', () => {
    document.body.innerHTML = '<button>Vivo</button>';
    expect(focusIsLost()).toBe(true);

    document.querySelector('button')?.focus();
    expect(focusIsLost()).toBe(false);
  });

  it('is true for a control inside something that is leaving', () => {
    document.body.innerHTML = '<div inert><button>Saindo</button></div>';
    document.querySelector('button')?.focus();

    expect(focusIsLost()).toBe(true);
  });
});
