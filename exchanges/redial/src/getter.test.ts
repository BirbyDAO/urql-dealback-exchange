import { createFromPath } from './getter';

it('should return value from path', function () {
  const matcher = createFromPath('$.start.but.deep');
  const sym = Symbol();
  expect(matcher({ start: { but: { deep: sym } } })).toBe(sym);
});

it('should return null in non path', function () {
  const matcher = createFromPath('$.test');
  const sym = Symbol();
  expect(matcher({ start: sym })).toBe(null);
});

it('should match arrays', function () {
  const matcher = createFromPath('$.0');
  const sym = Symbol();
  expect(matcher([sym])).toBe(sym);
});
