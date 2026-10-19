import { describe, it, expect } from 'vitest';
import { IntakeFields } from '../src/server/intake.js';
describe('AI extraction validation', () => {
 it('accepts bounded structured output', () => {
  expect(IntakeFields.parse({documentType:'Contract',counterparty:'Sample Ltd',effectiveDate:null,summary:'Test summary',risks:['Missing signature']}).risks).toHaveLength(1);
 });
 it('rejects unbounded risk lists', () => {
  expect(IntakeFields.safeParse({documentType:'Contract',counterparty:'Sample',effectiveDate:null,summary:'Test',risks:Array(12).fill('risk')}).success).toBe(false);
 });
 it('rejects missing required fields', () => expect(IntakeFields.safeParse({summary:'Test'}).success).toBe(false));
});
