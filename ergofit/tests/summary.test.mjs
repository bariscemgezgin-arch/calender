import test from 'node:test';
import assert from 'node:assert/strict';
import { redact, buildPrompt } from '../js/summary.js';

test('ad ve ekleri gizlenir, benzer kelimeler korunur', () => {
  const r = redact("Ada'nın makas becerisi iyi. Adaya alışkanlık kazandırdık. Ada Test geldi.", 'Ada Test');
  assert.equal(r, 'çocuk makas becerisi iyi. çocuk alışkanlık kazandırdık. çocuk çocuk geldi.');
});

test('Türkçe büyük harf İ ile yazılan ad', () => {
  assert.equal(redact('İREM bugün çok iyiydi', 'Irem İrem'), 'çocuk bugün çok iyiydi');
});

test('uzun kelime içinde geçen kısa ad bozulmaz', () => {
  assert.equal(redact('Alışkanlık gelişti', 'Ali Veli'), 'Alışkanlık gelişti');
});

test('telefon ve e-posta maskelenir', () => {
  const r = redact('Veli 0555 169 03 12 ve a.b@x.com', 'Zed Yok');
  assert.ok(r.includes('[numara]') && r.includes('[e-posta]') && !/0555/.test(r));
});

test('istem eskiden yeniye sıralanır ve ad içermez', () => {
  const p = buildPrompt({ name: 'Ada Test', age: '5 yaş', focus: [{ text: 'Ada makas', achieved: false }], notes: [{ text: 'ikinci', date: '2' }, { text: 'Ada birinci', date: '1' }] });
  assert.ok(p.user.indexOf('birinci') < p.user.indexOf('ikinci'));
  assert.ok(!/Ada/.test(p.user));
  assert.equal(p.noteCount, 2);
});
