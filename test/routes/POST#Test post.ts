import { OptionalBoolean } from 'schema.io';
import { IAPI } from '../../src';

export default {
  body: {
    tel: { type: String, match: /^1[0-9]{10}$/ },
    name: String,
    gender: OptionalBoolean,
  },
  async handler(params, query, { tel, name, gender }: { tel: string, name: string, gender?: boolean }) {
    return {
      tel,
      name,
      gender,
    };
  },
} as IAPI;
