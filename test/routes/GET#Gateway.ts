import { IAPI } from '../../src';

export default {
  query: {
    name: String,
  },
  res: String,
  async handler(params, { name }: { name: string }): Promise<string> {
    return `Hello ${name}`;
  },
  pre: [async (ctx, next) => {
    ctx.set('file', __filename);
    await next();
  }],
} as IAPI;
