import assert from "node:assert/strict";
import { test } from "node:test";
import { AuthoritativeSessionStore } from "../session/AuthoritativeSessionStore.js";
import { SessionThread } from "../thread/SessionThread.js";
import { executeShoppingTool } from "./shoppingTools.js";

test("full catalog tool results stay compact while preserving authoritative quotes", () => {
  const store = new AuthoritativeSessionStore();
  const s = store.create();
  const input = {sessionId:s.sessionId, epoch:s.epoch, baseRevision:s.revision, eventId:"size", turnId:"size-turn", modality:"text" as const, text:"Find me something useful", visibleRevision:s.revision, visibleProductIds:[]};
  store.ingestInput(input);
  input.baseRevision = store.get(s.sessionId)!.revision;
  const thread = new SessionThread(store.get(s.sessionId)!);
  const result = executeShoppingTool({name:"search_catalog", arguments:{category:null, query:null}, input, store, thread});
  assert.equal(result.ok, true);
  const bytes = Buffer.byteLength(JSON.stringify(result));
  assert.ok(bytes < 40_000, `Catalog response is ${bytes} bytes`);
  const products = (result.data as {products: Array<{product:{id:string};quotes:Array<{offer:{id:string};totalMinor:number|null;eligible:boolean;conflicts:unknown[]}>}>}).products;
  assert.ok(products.length > 0);
  assert.ok(products.length <= 12, "search quotes at most one bounded page");
  for (const row of products) for (const quote of row.quotes) {
    const original = store.quotes(s.sessionId, row.product.id).find(q => q.offer.id === quote.offer.id)!;
    assert.equal(quote.totalMinor, original.total);
    assert.equal(quote.eligible, original.eligible);
    assert.equal(quote.conflicts.length, original.conflicts.length);
  }
});
