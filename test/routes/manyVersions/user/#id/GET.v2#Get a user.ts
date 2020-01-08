import { IAPI } from '../../../../../src';

export default {
  description: '这是第二版接口',
  params: {
    id: String,
  },
  async handler({ params }: { params: { id: string } }) {
    return `Hey 😝 ${params.id}`;
  },
} as IAPI;
