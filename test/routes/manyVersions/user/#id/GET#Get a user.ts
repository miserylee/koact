import { IAPI } from '../../../../../src';

export default {
  params: {
    id: String,
  },
  async handler({ params }: { params: { id: string } }) {
    return `Hello ${params.id}`;
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
