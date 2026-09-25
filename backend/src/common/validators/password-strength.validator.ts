import { registerDecorator, ValidationOptions } from 'class-validator';

/**
 * Requires at least one lowercase letter, one uppercase letter,
 * one digit, and one symbol (min length is still enforced
 * separately by @MinLength(8) alongside this — that decorator's
 * own message stays specific to length, this one to composition).
 * A plain @Matches() regex, not the built-in @IsStrongPassword()
 * decorator — there is no real node_modules install available in
 * this environment to confirm which class-validator version (and
 * therefore which decorators) is actually present, so this avoids
 * betting on an unverified import the same way an unverified
 * CronExpression enum member was avoided earlier this session.
 *
 * Verified against real examples before use, including the
 * existing seed password ('ChangeMe123!' in
 * scripts/seed-platform-admin.ts and the demo company seed) to
 * confirm this policy does not accidentally break seeding.
 *
 * Applied everywhere a NEW password is being SET (create-user,
 * set-password, reset-password, signup) — deliberately NOT applied
 * to LoginDto, which validates an EXISTING password for a match,
 * not a new one being chosen; an existing user's password created
 * before this policy existed must still be able to log in.
 */
export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isStrongPassword',
      target: object.constructor,
      propertyName,
      options: {
        message: 'Password must include at least one lowercase letter, one uppercase letter, one number, and one symbol.',
        ...validationOptions,
      },
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') return false;
          return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).*$/.test(value);
        },
      },
    });
  };
}
