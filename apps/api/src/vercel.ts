import { getRequestListener } from '@hono/node-server';
import { createApp, lazyServices } from './app';

// Entry point bundled into the Vercel Function by scripts/build-vercel.mjs.
const app = createApp(lazyServices(process.env));
export default getRequestListener(app.fetch);
