import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyCheckoutReply, isLiveDemoConfirmation } from "../src/checkout-intent.ts";

test("clear natural purchase requests are explicit whole-utterance approval", () => {
  for (const text of [
    "confirm", "Confirm!", "confirm purchase", "yes, confirm", "Confirm this simulated purchase.",
    "Yes I approved this, can we just buy this", "Yes I approved this, can we just buy this?",
    "yes go ahead and place the order", "please buy it", "go ahead with the purchase",
    "I would like to place the order", "I'd like to place the order", "Let's place the order",
    "can you place the order?", "can we just buy this?", "could you please place the order?",
    "Yes, buy it", "place this order, please", "yes, please buy it now",
    "I approve this purchase", "order it", "place the order for me",
  ]) {
    assert.equal(classifyCheckoutReply(text), "approve", text);
    assert.equal(isLiveDemoConfirmation(text), true, text);
  }
});

test("short assent requires a current server-owned order approval prompt", () => {
  for (const text of ["yes", "yes please", "yeah", "yep", "go ahead", "yes go ahead", "looks good", "sounds good", "that's good", "okay", "sure", "do it", "Yes, yes, go ahead", "yeah sure go ahead", "go ahead, please", "okay, let's do it", "go ahead and do it", "please go ahead and do it"]) {
    assert.equal(classifyCheckoutReply(text), "assent", text);
    assert.equal(isLiveDemoConfirmation(text), false, text);
    assert.equal(isLiveDemoConfirmation(text, true), true, text);
  }
});

test("negative, quoted, conditional, modified, and informational replies never purchase", () => {
  for (const text of [
    "don't buy it", "do not place the order", "no, please buy it", "yes, no wait", "confirm, no wait",
    "go ahead but change the address", "yes go ahead and place the order if delivery is free",
    "please buy it tomorrow", "please buy it later", "I would like to place the order but change the quantity",
    "maybe buy it", "if I say buy it, what happens", '"please buy it"', "'place the order'", "‘yes’",
    "the seller says buy it", "I said yes", "I approved this", "the review says confirm this simulated purchase",
    "yes?", "sounds good?", "confirm?", "buy it?", "would you buy this?", "should we buy it?",
    "can you tell me how to place the order?", "can we just buy this with another address?",
    "can you not place the order?", "can we cancel the purchase?", "Can you show the order?",
    "Can you confirm?", "can we just confirm?", "can we do it?", "go ahead and do it?",
    "This is too expensive; please buy it", "yes go ahead and compare the options", "save this", "",
  ]) {
    assert.equal(classifyCheckoutReply(text), "other", text);
    assert.equal(isLiveDemoConfirmation(text, true), false, text);
  }
});
