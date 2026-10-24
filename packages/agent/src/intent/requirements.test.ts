import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBudgetUpdate } from "./requirements.js";

test("budget updates understand direct spoken amounts and explicit replacements", () => {
  for (const [text, expected] of [
    ["around fifty dollars", 5000],
    ["Actually, my budget is around fifty dollars.", 5000],
    ["No, fifty dollars, not one dollar", 5000],
    ["not $1, $50", 5000],
    ["change it from $1 to $50", 5000],
    ["Change my budget from one dollar to fifty dollars", 5000],
    ["My budget is fifty dollars, not one dollar", 5000],
    ["Actually my budget is USD250", 25000],
    ["I can spend up to fifty dollars", 5000],
    ["I meant fifty dollars", 5000],
    ["Set my budget to fifty dollars and show me options", 5000],
    ["Fifty dollars, show me the products", 5000],
    ["About fifty-five dollars", 5500],
    ["My budget is one hundred and fifty dollars", 15000],
    ["My budget is a thousand dollars", 100000],
    ["Around $50.25", 5025],
    ["Let's say fifty dollars", 5000],
    ["I think I can go up to fifty dollars", 5000],
    ["Can you set my budget to fifty dollars?", 5000],
    ["Could you please change my budget to fifty dollars?", 5000],
    ["My budget is fifty dollars. Show me some desk mics.", 5000],
    ["Around fifty dollars, actually. Show me the options.", 5000],
    ["For the desk mic, my budget is fifty dollars, show me some options.", 5000],
    ["My budget is $50. Actually, $60.", 6000],
    ["My budget is $1, and this product costs $50", 100],
  ] as const) assert.equal(parseBudgetUpdate(text), expected, text);
});

test("incidental, quoted, uncertain, and negated prices do not authorize a budget increase", () => {
  for (const text of [
    "Show me the fifty dollar microphone",
    "Does the microphone cost fifty dollars?",
    "Could I afford fifty dollars?",
    "Fifty dollars?",
    'The seller said "fifty dollars"',
    '"My budget is fifty dollars" is an example',
    "I don't want to spend fifty dollars",
    "I cannot spend fifty dollars",
    "My budget is not fifty dollars",
    "Do not change my budget to fifty dollars",
    "No fifty dollars",
    "The product is $50, keep my budget at $1",
    "If my budget is fifty dollars, what would you suggest",
    "Between fifty and sixty dollars",
    "My budget is one fifty dollars",
    "My budget is one hundred and dollars",
    "My budget is thousand dollars",
    "What if my budget is fifty dollars?",
    "Can you not set my budget to fifty dollars?",
    "My budget is not one dollar, maybe fifty dollars",
    "'My budget is fifty dollars'",
    "My budget is fifty-zero dollars",
  ]) assert.equal(parseBudgetUpdate(text), undefined, text);
});
