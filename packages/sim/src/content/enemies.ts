import type { EnemyDef } from './schema';

export const ENEMY_DEFS: EnemyDef[] = [
  {
    type: 'grunt',
    name: 'Grunt',
    description: 'The bulk of the horde.',
    hp: 40,
    speed: 1,
    armor: 0,
    magicResist: 0,
    bounty: 5,
    lifeCost: 1,
    flying: false,
  },
];
