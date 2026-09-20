import { randomInt } from 'node:crypto';

const FIVE_DIGIT_MIN = 10000;
const FIVE_DIGIT_MAX_EXCLUSIVE = 100000;

const asciiName = (name) => name
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim();

const padBase = (value, fallback) => {
  const base = value || fallback;
  return base.length >= 3 ? base : `${base}SPS`.slice(0, 3);
};

const randomFiveDigits = () => String(randomInt(FIVE_DIGIT_MIN, FIVE_DIGIT_MAX_EXCLUSIVE));

const buildStudentPassword = (name, passwordSuffix = randomFiveDigits()) => {
  if (!/^\d{5}$/.test(passwordSuffix)) {
    throw new Error('Credential suffixes must contain exactly five digits');
  }

  const normalizedName = asciiName(name);
  const passwordBase = padBase(normalizedName.replace(/[^a-zA-Z0-9]/g, ''), 'Student').slice(0, 59);
  return `${passwordBase}${passwordSuffix}`;
};

const buildStudentCredentials = (
  name,
  usernameSuffix = randomFiveDigits(),
  passwordSuffix = randomFiveDigits()
) => {
  if (!/^\d{5}$/.test(usernameSuffix) || !/^\d{5}$/.test(passwordSuffix)) {
    throw new Error('Credential suffixes must contain exactly five digits');
  }

  const normalizedName = asciiName(name);
  const usernameBase = padBase(
    normalizedName.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, ''),
    'student'
  ).slice(0, 44);

  return {
    username: `${usernameBase}.${usernameSuffix}`,
    password: buildStudentPassword(name, passwordSuffix),
  };
};

export { buildStudentCredentials, buildStudentPassword, randomFiveDigits };
export default buildStudentCredentials;
