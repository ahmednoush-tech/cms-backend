/**
 * TEST-ONLY helper. Services that create notifications now call
 * NotificationsService.create() instead of prisma.notification.create()
 * directly. Their existing unit tests assert on the mocked
 * prisma.notification.create call (which fields each service sends),
 * so this adapter forwards create() to exactly that mock, in exactly
 * the shape those tests already expect ({ data: ... }) — every
 * existing assertion keeps testing what it was written to test.
 *
 * NotificationsService's OWN behavior (after-commit push, scoping,
 * mark-read) is tested separately in notifications.service.spec.ts.
 *
 * Deliberately typed without any Jest types, so this file can never
 * break the production `nest build` (which compiles all of src/).
 */
export function notificationsServiceBackedBy(prisma: { notification: { create: (args: { data: unknown }) => unknown } }) {
  return {
    create: (input: unknown) => prisma.notification.create({ data: input }),
  };
}
