import { redactSecrets, diffForAudit, maskForViewer, REDACTED, HIDDEN } from './audit-redaction';

const PAY = 'Payroll:runs:view';
const HR = 'Administration:employees:view';

describe('audit-redaction', () => {
  describe('redactSecrets (write time)', () => {
    it('never stores a quotation share-link token', () => {
      expect(redactSecrets({ quotationNumber: 'QT-1', publicToken: 'abc' }).publicToken).toBe(REDACTED);
    });
    it('redacts nested and snake_case secrets, keeps neighbours', () => {
      const out: any = redactSecrets({ user: { email: 'a@b.c', passwordHash: 'x', password_reset_token: 't' } });
      expect(out.user).toEqual({ email: 'a@b.c', passwordHash: REDACTED, password_reset_token: REDACTED });
    });
    it('leaves a null secret as null ("not set", not a fake redaction)', () => {
      expect(redactSecrets({ apiSecretEncrypted: null }).apiSecretEncrypted).toBeNull();
    });
    it('does not treat the ZATCA invoice hash as a secret', () => {
      expect(redactSecrets({ invoiceHash: 'h' }).invoiceHash).toBe('h');
    });
    it('turns Decimals and Dates into plain JSON values', () => {
      const out = redactSecrets({ total: { toJSON: () => '1500.00' }, at: new Date('2026-01-01T00:00:00Z') });
      expect(out).toEqual({ total: '1500.00', at: '2026-01-01T00:00:00.000Z' });
    });
  });

  describe('diffForAudit (write time)', () => {
    const before = { id: 'e1', jobTitle: 'Tech', basicSalary: '8000', updatedAt: 'a', department: { id: 'd1' } };
    const after = { id: 'e1', jobTitle: 'Senior', basicSalary: '9500', updatedAt: 'b' };

    it('keeps only the fields that changed', () => {
      expect(diffForAudit(before, after)).toEqual({
        oldValues: { jobTitle: 'Tech', basicSalary: '8000' },
        newValues: { jobTitle: 'Senior', basicSalary: '9500' },
      });
    });
    it('ignores a relation included only in the "before" read (not a real removal)', () => {
      expect(diffForAudit(before, after).oldValues).not.toHaveProperty('department');
    });
    it('keeps full snapshots for creates and deletes', () => {
      expect(diffForAudit(null, after).newValues).toBe(after);
      expect(diffForAudit(before, null).oldValues).toBe(before);
    });
  });

  describe('maskForViewer (read time)', () => {
    const stored = { basicSalary: '9500', netPay: '8000', gosiEmployeeDeduction: '100', iqamaNumber: '212', nationality: 'SD', jobTitle: 'Senior' };

    it('hides pay AND identity from an audit-only viewer, keeps ordinary fields', () => {
      expect(maskForViewer(stored, [])).toEqual({
        basicSalary: HIDDEN, netPay: HIDDEN, gosiEmployeeDeduction: HIDDEN, iqamaNumber: HIDDEN, nationality: HIDDEN, jobTitle: 'Senior',
      });
    });
    it('payroll permission reveals pay only; HR permission reveals identity only', () => {
      const pay: any = maskForViewer(stored, [PAY]);
      const hr: any = maskForViewer(stored, [HR]);
      expect([pay.basicSalary, pay.iqamaNumber]).toEqual(['9500', HIDDEN]);
      expect([hr.basicSalary, hr.iqamaNumber]).toEqual([HIDDEN, '212']);
    });
    it('hides a secret from a LEGACY row (written before redaction existed), even for a fully-privileged viewer', () => {
      expect((maskForViewer({ publicToken: 'leaked' }, [PAY, HR]) as any).publicToken).toBe(REDACTED);
    });
    it('reaches into arrays, and never mutates the stored object', () => {
      const row = { items: [{ netPay: '1' }] };
      expect((maskForViewer(row, []) as any).items[0].netPay).toBe(HIDDEN);
      expect(row.items[0].netPay).toBe('1');
    });
  });
});
