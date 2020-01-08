import { IMeta } from '../../../../src';

export default {
  title: 'nested doc',
  pre: [async (ctx, next) => {
    throw new Error('this error should not effect the doc');
  }],
} as IMeta;
