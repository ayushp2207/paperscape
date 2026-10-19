import { ObjectId } from 'mongodb';

export class ValidationError extends Error {
  constructor(details, message = 'Validation failed') {
    super(message);
    this.status = 400;
    this.details = details;
  }
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const notFound = (what = 'Resource') => new HttpError(404, `${what} not found`);

export function isNonEmptyString(value, maxLength = Infinity) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;
}

export function isOptionalString(value, maxLength = Infinity) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.length <= maxLength)
  );
}

export function isObjectIdString(value) {
  return (
    typeof value === 'string' && ObjectId.isValid(value) && String(new ObjectId(value)) === value
  );
}

// Throws a 404 (not 400) so a malformed id looks the same as a missing document.
export function toObjectId(value, what = 'Resource') {
  if (!isObjectIdString(value)) throw notFound(what);
  return new ObjectId(value);
}

export function isOneOf(value, allowed) {
  return allowed.includes(value);
}

export function isIntInRange(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

export function pick(source, keys) {
  return Object.fromEntries(keys.filter((key) => key in source).map((key) => [key, source[key]]));
}

export function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Collects field errors, then throws once: const v = validator(); v.check(...); v.done();
export function validator() {
  const details = {};
  return {
    check(condition, field, message) {
      if (!condition && !details[field]) details[field] = message;
    },
    done() {
      if (Object.keys(details).length > 0) throw new ValidationError(details);
    },
  };
}
