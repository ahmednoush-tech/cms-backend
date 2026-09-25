import { toCsv } from './csv.util';

describe('csv.util', () => {
  it('returns an empty string for no rows', () => {
    expect(toCsv([])).toBe('');
  });

  it('uses the first row\'s keys as columns, in order', () => {
    const csv = toCsv([{ label: 'New', value: 5 }]);
    expect(csv).toBe('label,value\r\nNew,5');
  });

  it('applies custom header labels when provided', () => {
    const csv = toCsv([{ label: 'New', value: 5 }], { label: 'Status', value: 'Count' });
    expect(csv.split('\r\n')[0]).toBe('Status,Count');
  });

  it('wraps a value containing a comma in double quotes', () => {
    const csv = toCsv([{ label: 'Won, Big Deal', value: 3 }]);
    expect(csv).toContain('"Won, Big Deal",3');
  });

  it('doubles internal double quotes and wraps the whole value', () => {
    const csv = toCsv([{ label: 'Say "hello"', value: 1 }]);
    expect(csv).toContain('"Say ""hello""",1');
  });

  it('wraps a value containing a newline in double quotes', () => {
    const csv = toCsv([{ label: 'Line one\nLine two', value: 2 }]);
    expect(csv).toContain('"Line one\nLine two",2');
  });

  it('renders null or undefined as an empty field, not the literal string "null"', () => {
    const csv = toCsv([{ label: null, value: undefined }]);
    expect(csv).toBe('label,value\r\n,');
  });

  it('renders one line per row, in the same order given', () => {
    const csv = toCsv([
      { label: 'A', value: 1 },
      { label: 'B', value: 2 },
      { label: 'C', value: 3 },
    ]);
    expect(csv.split('\r\n')).toEqual(['label,value', 'A,1', 'B,2', 'C,3']);
  });
});
