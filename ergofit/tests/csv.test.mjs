import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTable, mapChildren, parseDate } from '../js/csv.js';

test('başlıklı noktalı virgül CSV', () => {
  const { children, hasHeader } = mapChildren(parseTable('Ad Soyad;Doğum Tarihi;Terapist;Çalışılan\nAda Test;05.03.2019;Ayşe;"kalem tutma; makas"\nBora Test;;;'));
  assert.equal(hasHeader, true);
  assert.equal(children.length, 2);
  assert.deepEqual(children[0], { name: 'Ada Test', birth: '2019-03-05', therapist: 'Ayşe', focus: ['kalem tutma', 'makas'], summary: '' });
});

test('Excel yapıştırması (sekme), başlıksız', () => {
  const { children, hasHeader } = mapChildren(parseTable('Ada Test\nBora Test\n\nCem Test'));
  assert.equal(hasHeader, false);
  assert.deepEqual(children.map(c => c.name), ['Ada Test', 'Bora Test', 'Cem Test']);
});

test('tırnak içinde virgül ve satır sonu', () => {
  const rows = parseTable('ad,not\n"Ada, Test","a\nb"\n');
  assert.deepEqual(rows[1], ['Ada, Test', 'a\nb']);
});

test('tarih biçimleri', () => {
  assert.equal(parseDate('2020-1-9'), '2020-01-09');
  assert.equal(parseDate('9/1/2020'), '2020-01-09');
  assert.equal(parseDate('31.02.2020'), '');
  assert.equal(parseDate('abc'), '');
});
