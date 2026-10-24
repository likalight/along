import assert from "node:assert/strict";
import { test } from "node:test";
import {
  allowsDeliveryExtension,
  allowsCapacityReduction,
  allowsRemovingShoeCompartment,
} from "./criteriaUpdates.js";

test("explicit delivery changes bind the new value, including spoken numbers and direct requests", () => {
  for (const text of [
    "Actually, delivery within five days is fine",
    "I can wait five days",
    "I'm happy to wait up to five days.",
    "Five days would be acceptable for me.",
    "Can you change delivery to five days?",
    "Could you please extend my delivery deadline to 5 days?",
    "Please change delivery from two days to five days.",
    "Delivery within five days is fine. Show me options.",
    "I can wait five days and please show me matching products",
  ]) {
    assert.equal(allowsDeliveryExtension(text, 5), true, text);
    assert.equal(allowsDeliveryExtension(text, 7), false, text);
  }
  assert.equal(allowsDeliveryExtension("I can wait twenty-one days", 21), true);
  assert.equal(allowsDeliveryExtension("Change delivery from two days to five days", 2), false);
});

test("delivery facts, hypotheticals, and negated changes cannot relax the deadline", () => {
  for (const text of [
    "Show me options",
    "The product takes five days to arrive",
    "The seller says delivery is five days",
    "What if I can wait five days?",
    "If I can wait five days, what changes?",
    '"I can wait five days"',
    "'I can wait five days'",
    "Do not change delivery to five days",
    "I cannot wait five days",
    "Can I wait five days?",
    "I can wait five days but keep the two-day deadline",
    "I can wait five days if it is cheaper",
  ]) assert.equal(allowsDeliveryExtension(text, 5), false, text);
  assert.equal(allowsDeliveryExtension("I can wait five days", Number.NaN), false);
  assert.equal(allowsDeliveryExtension("I can wait five days", 0), false);
});

test("explicit capacity changes accept a named smaller minimum without authorizing other values", () => {
  for (const text of [
    "A minimum of twenty litres is enough",
    "Twenty liters is enough for me.",
    "A 20-litre bag is fine for me",
    "I only need 20L",
    "I can make do with a twenty liter bag",
    "Could you reduce my minimum capacity to twenty litres?",
    "Lower minimum capacity from thirty litres to twenty litres",
    "Actually, a minimum of twenty litres is enough. Show me bags.",
    "Set my capacity minimum to 20 litres and show me options",
  ]) {
    assert.equal(allowsCapacityReduction(text, 20), true, text);
    assert.equal(allowsCapacityReduction(text, 15), false, text);
  }
  assert.equal(allowsCapacityReduction("Twenty-five litres is enough", 25), true);
  assert.equal(allowsCapacityReduction("A 20.5 litre bag is fine", 20.5), true);
  assert.equal(allowsCapacityReduction("Lower minimum from thirty litres to twenty litres", 30), false);
});

test("an advertised capacity, conditional, or quoted request is not permission to lower the minimum", () => {
  for (const text of [
    "Find a bag",
    "The product has twenty litres of capacity",
    "This is a twenty litre bag",
    "What if twenty litres is enough?",
    "Maybe twenty litres is enough",
    'He said "twenty litres is enough"',
    "'Twenty litres is enough'",
    "Do not reduce the minimum to twenty litres",
    "I only need twenty litres if the bag is cheaper",
    "Twenty litres is enough but keep my thirty litre minimum",
    "Can twenty litres be enough?",
  ]) assert.equal(allowsCapacityReduction(text, 20), false, text);
  assert.equal(allowsCapacityReduction("Twenty litres is enough", Infinity), false);
});

test("the shopper can explicitly remove or make optional a shoe compartment requirement", () => {
  for (const text of [
    "I do not need a separate shoe compartment",
    "Actually, I don't need a shoe compartment anymore.",
    "A separate shoe compartment is not necessary",
    "The shoe compartment isn't a must",
    "Please remove the shoe compartment requirement",
    "Could you drop my requirement for a separate shoe compartment?",
    "Make the shoe compartment optional",
    "Bags without a shoe compartment are fine with me",
    "I can go without a separate shoe compartment",
    "I'm okay without a shoe compartment",
    "I no longer need a shoe compartment. Show me options.",
  ]) assert.equal(allowsRemovingShoeCompartment(text), true, text);
});

test("feature absence and model suggestions do not authorize removing the shoe compartment requirement", () => {
  for (const text of [
    "Show me cheaper bags",
    "This bag has no separate shoe compartment",
    "The model recommends dropping the shoe compartment requirement",
    "What if I do not need a separate shoe compartment?",
    "Maybe make the shoe compartment optional",
    '"I do not need a separate shoe compartment"',
    "Do not remove the shoe compartment requirement",
    "I still need a separate shoe compartment",
    "I do not need a shoe compartment if it makes the bag cheaper",
    "I do not need a shoe compartment, but keep it required",
    "Do I need a shoe compartment?",
  ]) assert.equal(allowsRemovingShoeCompartment(text), false, text);
});
