import { File } from 'formidable';
import { IAPI } from '../../../src';

export default {
  body: {
    file: Object,
  },
  async handler({ body }: { body: { file: File } }) {
    const { file } = body;
    return { file };
  },
} as IAPI;
