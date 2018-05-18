import { IAPI } from '../../../../../src';

export default {
  params: {
    id: String,
  },
  async handler({ id }: { id: string }) {
    return `Hello ${id}`;
  },
  plugins: [api => {
    if (!api.pre) {
      api.pre = [];
    }
    api.pre.push(async (ctx, next) => {
      await next();
      ctx.set('file', __filename);
    });
    return api;
  }],
} as IAPI;
