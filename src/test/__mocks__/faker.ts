// Minimal faker mock to avoid ESM import issues in Jest (CJS environment)
const avatar = () => 'https://example.com/avatar.png';
const word = (len = 6) => 'word'.repeat(Math.ceil(len / 4)).slice(0, len);

module.exports = {
  faker: {
    string: {
      uuid: () => '00000000-0000-4000-8000-000000000000',
    },
    lorem: {
      word,
      words: word,
      sentence: () => 'mock sentence',
    },
    internet: {
      url: () => 'https://example.com',
      email: () => 'user@example.com',
      password: () => 'Q9password123456',
    },
    image: {
      avatar,
    },
    helpers: {
      fromRegExp: () => 'MockName',
    },
  },
};
