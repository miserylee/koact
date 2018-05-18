import { File } from 'formidable';
import { IAPI } from '../../../src';

export default {
  body: {
    file: Object,
  },
  async handler(params, query, { file }: { file: File }) {
    return { file };
  },
} as IAPI;
