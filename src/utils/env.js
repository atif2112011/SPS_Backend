const isTruthyEnv = (value) => ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());

const isFirebaseRuntime = () => Boolean(
  !isTruthyEnv(process.env.FUNCTIONS_EMULATOR)
  && (
    process.env.K_SERVICE
    || process.env.FUNCTION_TARGET
    || process.env.FUNCTION_NAME
  )
);

export { isTruthyEnv, isFirebaseRuntime };
export default { isTruthyEnv, isFirebaseRuntime };
