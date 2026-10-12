import { getRequestListener } from '@hono/node-server';
import { app } from './app';

// Entry point bundled into the Vercel Function by scripts/build-vercel.mjs.
export default getRequestListener(app.fetch);
