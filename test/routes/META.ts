import { IAPIBase, IMeta } from '../../src';

export default {
  title: 'This is the API documents.',
  plugins: [(api: IAPIBase, { method, name, path }) => {
    console.log(name, method, path);
    if (!api.pre) {
      api.pre = [];
    }
    api.pre.push(async (ctx, next) => {
      ctx.set('dir', __dirname);
      await next();
    });
    return api;
  }],
} as IMeta;
