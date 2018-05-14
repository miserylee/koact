import * as Koa from 'koa';
import * as path from 'path';
import koact from '../src';

const koa = new Koa();

koa.use(koact(path.resolve(__dirname, './routes')));

koa.listen(4000);

describe('Say hello', () => {
  it('to world should ok', () => {
  });
});
