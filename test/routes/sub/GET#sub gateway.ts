import { IAPI } from '../../../src';

export default {
  query: {
    string: String,
    number: Number,
    bool: Boolean,
    date: Date,
    object: Object,
    array: Array,
    nul: null,
    undef: undefined,
    nested: [[String]],
    complex: {
      arr: [{
        key: String,
      }],
    },
    alter: [String, Number],
    alterInArr: [[String, Boolean]],
  },
  explain: 'query.alter can be String or Number.',
} as IAPI;
