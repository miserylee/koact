import * as Koa from 'koa';
import * as path from 'path';
import koact from '../src';

const koa = new Koa();

koa.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    ctx.body = {
      error: {
        name: error.name,
        message: error.message,
      },
    };
  }
});
koa.use(koact(path.resolve(__dirname, './routes'), [], {
  docSecret: '123456',
}));

koa.listen(4000, () => console.log('server started.'));
