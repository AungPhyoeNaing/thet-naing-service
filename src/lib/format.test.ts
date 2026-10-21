import { expect, it } from 'vitest'
import { csv, money } from './format'
it('quotes CSV fields and neutralizes spreadsheet formula injection', () => { const text = csv([['=1+1','A "quote", comma','line\nbreak',100]]); expect(text).toContain("\"'=1+1\""); expect(text).toContain('"A ""quote"", comma"'); expect(text).toContain('"line\nbreak"'); expect(money(12345)).toBe('12,345 Ks') })
