import { IAPI } from '../../src';

export default {
  query: {
    name: String,
  },
  res: String,
  async handler({ query }): Promise<string> {
    return `Hello ${query.name}`;
  },
  pre: [async (ctx, next) => {
    ctx.set('file', __filename);
    await next();
  }],
} as IAPI<{}, {
  name: string;
}, {}, string>;
