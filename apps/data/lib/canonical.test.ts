import assert from "node:assert/strict";
import { test } from "node:test";
import { canonical } from "./canonical";

// Same literals as scraper/tests/test_pure.py: the two implementations must agree byte for byte.
test("matches the Python canonical form", () => {
  assert.equal(
    canonical({ title: "A Light in the Attic", price: 51.77, currency: "GBP", rating: 3, in_stock: 22 }),
    '{"currency":"GBP","in_stock":22,"price":"51.77","rating":3,"title":"A Light in the Attic"}',
  );
  assert.equal(
    canonical({ title: "T", price: 10, currency: "GBP", rating: 1, in_stock: 0 }),
    '{"currency":"GBP","in_stock":0,"price":"10.00","rating":1,"title":"T"}',
  );
});

test("null price stays null", () => {
  assert.match(canonical({ title: "T", price: null, currency: null, rating: null, in_stock: null }), /"price":null/);
});
