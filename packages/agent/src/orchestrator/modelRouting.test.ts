import assert from "node:assert/strict";
import { test } from "node:test";
import { routeShoppingModel } from "./modelRouting.js";

const empty = { hardConstraints: {}, preferences: {} };
test("choosing an already identified offer does not trigger deep comparison reasoning", () => {
  const remembered = {
    hardConstraints: { budgetMinor: 5000, category: "audio", compatibility: { hostConnection: "USB-C" } },
    preferences: { use: "calls", solutionType: "headset", color: "white" },
  };
  for (const text of ["Choose that offer", "Let's go with this one", "Continue with the EarPods", "Okay continue"]) {
    assert.equal(routeShoppingModel(text, remembered).reasoningEffort, "none");
  }
  assert.deepEqual(routeShoppingModel("Choose between them by price and durability", remembered), {
    model: "gpt-6.1-sol", reasoningEffort: "low", serviceTier: "fast", task: "constrained",
  });
});
test("simple filtering and preference corrections avoid reasoning overhead", () => {
  for (const text of [
    "Only show bags under $80",
    "I prefer blue",
    "My budget is 150",
    "Sort by price",
  ]) {
    assert.deepEqual(routeShoppingModel(text, empty), {
      model: "gpt-6-luna",
      reasoningEffort: "none",
      task: "simple",
    });
  }
});
test("ordinary recommendations and short comparisons use low effort", () => {
  for (const text of [
    "Recommend a gym bag",
    "Compare these two",
    "Which is cheaper?",
  ]) {
    assert.equal(routeShoppingModel(text, empty).reasoningEffort, "low");
  }
});
test("multi-constraint comparisons use both current request and accepted preferences", () => {
  const expected = { model: "gpt-6.1-sol", reasoningEffort: "low", serviceTier: "fast", task: "constrained" };
  assert.deepEqual(routeShoppingModel("Compare price, capacity and weight", empty), expected);
  assert.deepEqual(routeShoppingModel("Choose by price, capacity, weight, size and durability", empty), expected);
  assert.deepEqual(routeShoppingModel("Recommendations by price, weight and durability", empty), expected);
  assert.deepEqual(
    routeShoppingModel("Which would you recommend?", {
      hardConstraints: { maxPrice: 150, waterproof: true },
      preferences: { lightweight: true },
    }),
    expected,
  );
  assert.equal(
    routeShoppingModel("Sort by price", {
      hardConstraints: { maxPrice: 150, waterproof: true },
      preferences: { lightweight: true },
    }).reasoningEffort,
    "none",
  );
});
test("complex research uses Sol but subsequent routine turns are not sticky", () => {
  assert.deepEqual(
    routeShoppingModel(
      "Make a research plan for total cost of ownership",
      empty,
    ),
    {
      model: "gpt-6.1-sol",
      reasoningEffort: "low",
      serviceTier: "fast",
      task: "research",
    },
  );
  assert.equal(routeShoppingModel("Show only blue", empty).model, "gpt-6-luna");
  assert.deepEqual(routeShoppingModel("Research these products", empty), {
    model: "gpt-6.1-sol", reasoningEffort: "low", serviceTier: "fast", task: "research",
  });
  assert.equal(routeShoppingModel("Show only blue", empty).serviceTier, undefined);
});

test("service-tier and effort overrides remain explicit while automatic Sol uses supported effort", () => {
  assert.deepEqual(routeShoppingModel("Research these products", empty, {
    serviceTier: "default", reasoningEffort: "none",
  }), { model: "gpt-6.1-sol", reasoningEffort: "low", serviceTier: "default", task: "research" });
  assert.deepEqual(routeShoppingModel("Research these products", empty, {
    model: "gpt-6-astra", reasoningEffort: "high", serviceTier: "priority",
  }), { model: "gpt-6-astra", reasoningEffort: "high", serviceTier: "priority", task: "override" });
  assert.equal(routeShoppingModel("Compare price, capacity and weight", empty, { reasoningEffort: "high" }).reasoningEffort, "high");
});
test("operator model overrides preserve prior explicit configuration", () => {
  assert.deepEqual(
    routeShoppingModel("Compare price, weight and capacity", empty, {
      model: "gpt-6-astra",
      reasoningEffort: "high",
    }),
    { model: "gpt-6-astra", reasoningEffort: "high", task: "override" },
  );
});
