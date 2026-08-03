import { assert, setup, takeStep, resolveContact, count } from "./tactical-charge-brace-test-helpers.mjs";
const context = setup({ secondBracer: true }); context.extra.currentInitiativeTotal = 14; context.extra.currentInitiativeRank = 1; await takeStep(context, { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }); await takeStep(context, { from: { x: 1, y: 0 }, to: { x: 2, y: 0 } });
assert.equal(count(context.events, "tactical-interception-window-created"), 1); assert.equal(count(context.events, "tactical-interception-resolution-admitted"), 1); assert.equal(count(context.events, "tactical-brace-trigger-rejected"), 1);
const contact = await resolveContact(context); assert.equal(contact.calls, 1); const duplicate = await resolveContact(context); assert.equal(duplicate.calls, 0);
assert.equal(context.runtime.interceptionExecutionClaims.size, 1); assert.equal(context.runtime.contactExecutionClaims.size, 1);
assert.equal(context.runtime.bracesByActor.get("bracer-b").state, "held"); assert.equal(context.runtime.bracesByActor.get("bracer").state, "recovering");
console.log("tactical charge brace idempotence: 9/9 passed");
