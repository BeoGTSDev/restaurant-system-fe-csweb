// Test file: checks orderRules.test behavior and protects it from later changes.
import assert from "node:assert/strict";
import test from "node:test";
import {
  displayProductName,
  formatMoney,
  isSessionExpired,
  isVisibleMenuProduct,
  menuAvailabilityRank
} from "../app/orderRules.ts";

test("uses the customer-facing dish name when one is configured", () => {
  assert.equal(displayProductName({ name: "P-Internal", displayName: "Pumpkin Risotto", status: "In Stock" }), "Pumpkin Risotto");
});

test("hides everyday-disabled products but keeps today's sold-out products visible", () => {
  assert.equal(isVisibleMenuProduct({ name: "A", status: "Disabled" }), false);
  assert.equal(isVisibleMenuProduct({ name: "B", status: "Out of Stock" }), true);
});

test("sorts available, limited, then sold-out menu items", () => {
  assert.equal(menuAvailabilityRank({ name: "A", status: "In Stock" }), 0);
  assert.equal(menuAvailabilityRank({ name: "B", status: "In Stock", remainingQty: 3 }), 1);
  assert.equal(menuAvailabilityRank({ name: "C", status: "Out of Stock", remainingQty: 0 }), 2);
});

test("expires a customer session after five minutes of inactivity", () => {
  assert.equal(isSessionExpired(1_000, 300_999), false);
  assert.equal(isSessionExpired(1_000, 301_000), true);
});

test("formats VND using the selected locale", () => {
  assert.match(formatMoney(150000, "vi"), /150[\.\s]000/);
  assert.match(formatMoney(150000, "en"), /150,000/);
});
