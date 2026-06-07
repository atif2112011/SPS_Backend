const isTruthyEnv = (value) => ['1', 'true', 'yes'].includes(String(value || '').toLowerCase());

const isVercelRuntime = () => isTruthyEnv(process.env.VERCEL);

module.exports = { isTruthyEnv, isVercelRuntime };
