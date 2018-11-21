import { Middleware } from 'koa';

export const pre: Middleware[] = [async (ctx, next) => {
  ctx.set('dir', __dirname);
  await next();
}];
