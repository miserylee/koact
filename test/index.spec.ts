import * as assert from 'assert';
import sayHello from '../src';

describe('Say hello', () => {
  it('to world should ok', () => {
    assert(sayHello('world') === 'Hello, world');
  });
});
