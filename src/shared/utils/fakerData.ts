import { faker } from "@faker-js/faker";

faker.seed(123);

const data = Array.from({ length: 20 }, () => ({
  key: faker.string.uuid(),
  title: faker.music.artist(),
  image: faker.image.url({ width: 300, height: 300 * 1.4 }),
  bg: faker.color.rgb(),
  description: faker.lorem.sentences({ min: 1, max: 3 }),
  author: {
    name: faker.person.fullName(),
    avatar: faker.image.avatarGitHub(),
  },
}));

export default data;

export type Item = (typeof data)[0];
