// Run with:  npm test    (node --test --experimental-strip-types)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkInvoiceRule,
  calcDue,
  applyPayment,
  type ExistingInvoiceRow,
} from '../lib/invoiceRules.ts';

test('no invoice number is always allowed', () => {
  assert.equal(checkInvoiceRule('A', '', []).ok, true);
  assert.equal(checkInvoiceRule('D', '   ', []).ok, true);
  assert.equal(checkInvoiceRule('A', undefined, []).ok, true);
});

test('Type A: first use of an invoice is allowed', () => {
  assert.equal(checkInvoiceRule('A', '784', []).ok, true);
});

test('Type A: duplicate invoice is rejected with 409', () => {
  const existing: ExistingInvoiceRow[] = [{ type: 'A', due: 270 }];
  const r = checkInvoiceRule('A', '784', existing);
  assert.equal(r.ok, false);
  assert.equal(r.status, 409);
  assert.match(r.error ?? '', /cannot be duplicated/i);
});

test('Type A: duplicate rejected even when no balance remains', () => {
  const existing: ExistingInvoiceRow[] = [{ type: 'D', due: 0 }];
  assert.equal(checkInvoiceRule('A', '784', existing).ok, false);
});

test('Type D: duplicate allowed when balance remains', () => {
  const existing: ExistingInvoiceRow[] = [{ type: 'A', due: 200 }];
  const r = checkInvoiceRule('D', '784', existing);
  assert.equal(r.ok, true);
});

test('Type D: duplicate rejected when fully settled (due = 0)', () => {
  const existing: ExistingInvoiceRow[] = [{ type: 'D', due: 0 }];
  const r = checkInvoiceRule('D', '784', existing);
  assert.equal(r.ok, false);
  assert.equal(r.status, 409);
  assert.match(r.error ?? '', /settled/i);
});

test('Type D: balance summed across multiple existing rows', () => {
  const existing: ExistingInvoiceRow[] = [
    { type: 'A', due: 0 },
    { type: 'D', due: 50 },
  ];
  assert.equal(checkInvoiceRule('D', '784', existing).ok, true);
});

test('invalid type is rejected with 400', () => {
  // @ts-expect-error testing runtime guard with a bad type
  const r = checkInvoiceRule('X', '784', [{ type: 'A', due: 5 }]);
  assert.equal(r.ok, false);
  assert.equal(r.status, 400);
});

test('calcDue never goes negative', () => {
  assert.equal(calcDue(320, 50), 270);
  assert.equal(calcDue(100, 200), 0);
  assert.equal(calcDue(0, 0), 0);
});

test('applyPayment settles oldest dues first', () => {
  const rows = [
    { id: 'a', due: 100 },
    { id: 'b', due: 100 },
    { id: 'c', due: 100 },
  ];
  const out = applyPayment(rows, 150);
  assert.deepEqual(out, [
    { id: 'a', due: 0 },
    { id: 'b', due: 50 },
    { id: 'c', due: 100 },
  ]);
});

test('applyPayment ignores already-paid rows and caps at total due', () => {
  const rows = [
    { id: 'a', due: 0 },
    { id: 'b', due: 80 },
  ];
  const out = applyPayment(rows, 999);
  assert.deepEqual(out, [
    { id: 'a', due: 0 },
    { id: 'b', due: 0 },
  ]);
});
