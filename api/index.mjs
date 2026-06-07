process.env.VERCEL ||= 'true';

const { default: app } = await import('../server.js');

export default app;
