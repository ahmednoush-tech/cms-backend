import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { StreamTicketService } from './stream-ticket.service';

describe('StreamTicketService', () => {
  const ACCESS_SECRET = 'access-secret-for-tests';
  const jwt = new JwtService({});
  const config = { get: (k: string) => (k === 'JWT_ACCESS_SECRET' ? ACCESS_SECRET : undefined) } as any;
  const service = new StreamTicketService(jwt, config);

  it('round-trips: an issued ticket verifies back to the same user and company', () => {
    const { ticket, expiresIn } = service.issue('u1', 'c1');
    expect(expiresIn).toBe(60);
    expect(service.verify(ticket)).toEqual({ userId: 'u1', companyId: 'c1' });
  });

  it('rejects a missing ticket', () => {
    expect(() => service.verify(undefined)).toThrow(UnauthorizedException);
  });

  it('rejects a normal ACCESS token used as a ticket (different signing key)', () => {
    const accessToken = jwt.sign({ sub: 'u1', companyId: 'c1' }, { secret: ACCESS_SECRET });
    expect(() => service.verify(accessToken)).toThrow(UnauthorizedException);
  });

  it('a ticket is useless as an ACCESS token — it does not verify under the access secret', () => {
    const { ticket } = service.issue('u1', 'c1');
    expect(() => jwt.verify(ticket, { secret: ACCESS_SECRET })).toThrow();
  });

  it('rejects a token signed with the right key but the wrong purpose', () => {
    const wrongPurpose = jwt.sign({ sub: 'u1', companyId: 'c1', purpose: 'something_else' }, { secret: `${ACCESS_SECRET}::notification-stream-ticket` });
    expect(() => service.verify(wrongPurpose)).toThrow(UnauthorizedException);
  });

  it('rejects an expired ticket', () => {
    const expired = jwt.sign({ sub: 'u1', companyId: 'c1', purpose: 'notification_stream' }, { secret: `${ACCESS_SECRET}::notification-stream-ticket`, expiresIn: -1 });
    expect(() => service.verify(expired)).toThrow(UnauthorizedException);
  });
});
