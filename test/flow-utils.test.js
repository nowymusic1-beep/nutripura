import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateOrder, firstNameFromFlowOptional, flowOptionalData, mapFlowStatus,
  normalizeChileanPhone, signFlowParams, validateCustomer,
} from "../lib/flow-utils.js";
import { createMetaEvent } from "../lib/meta-utils.js";

test("calculates the same discounted total for a two-product order", () => {
  assert.deepEqual(
    calculateOrder([
      { id: "berberina", quantity: 1 },
      { id: "magnesio", quantity: 1 },
    ]),
    {
      items: [
        { id: "berberina", name: "Berberina Nutre Pure", quantity: 1, unitPrice: 24990 },
        { id: "magnesio", name: "Magnesium Complex Nutre Pure", quantity: 1, unitPrice: 14850 },
      ],
      subtotal: 39840,
      discount: 3984,
      shipping: 3990,
      amount: 39846,
    },
  );
});

test("rejects unknown, duplicate, and invalid quantity entries", () => {
  for (const items of [
    [{ id: "unknown", quantity: 1 }],
    [{ id: "berberina", quantity: 1 }, { id: "berberina", quantity: 2 }],
    [{ id: "magnesio", quantity: 0 }],
    [{ id: "magnesio", quantity: 100 }],
    [{ id: "magnesio", quantity: 1.5 }],
  ]) {
    assert.throws(() => calculateOrder(items));
  }
});

test("signs Flow parameters in sorted key order", () => {
  assert.equal(
    signFlowParams({ commerceOrder: "order-1", apiKey: "api-key", amount: "1000" }, "secret"),
    "aa3aa6d3d2253fcd56eae4653411892d5809c3048eaa5aeb30543cbf0b49bb92",
  );
});

test("maps Flow payment states without treating pending as paid", () => {
  assert.equal(mapFlowStatus(2), "paid");
  assert.equal(mapFlowStatus(1), "pending");
  assert.equal(mapFlowStatus(4), "failed");
  assert.equal(mapFlowStatus(5), "refunded");
});

test("builds a deduplicatable Meta event with hashed email and product data", () => {
  const event = createMetaEvent("Purchase", {
    metaEventId: "event-123",
    metaEventSourceUrl: "https://nutricionpura-805c9.web.app/",
    email: " Shopper@Example.com ",
    currency: "CLP",
    amount: 22491,
    items: [{ id: "berberina", quantity: 1 }],
    metaFbp: "fb.1.123.456",
    metaFbc: null,
    metaUserAgent: null,
  });
  assert.equal(event.event_name, "Purchase");
  assert.equal(event.event_id, "event-123");
  assert.equal(event.user_data.em[0], "a85e9ca18f34935ab9b0381b25bfad2455444112b0149270fd88e3da172fe196");
  assert.equal(event.user_data.fbp, "fb.1.123.456");
  assert.deepEqual(event.custom_data, {
    currency: "CLP",
    value: 22491,
    content_type: "product",
    content_ids: ["berberina"],
    contents: [{ id: "berberina", quantity: 1 }],
  });
});

test("normalizes Chilean mobile numbers", () => {
  for (const value of ["912345678", "9 1234 5678", "+56 9 1234 5678", "56912345678"]) {
    assert.equal(normalizeChileanPhone(value), "+56912345678");
  }
  for (const value of ["12345678", "812345678", "+56 2 2123 4567", ""]) {
    assert.equal(normalizeChileanPhone(value), null);
  }
});

const validCustomer = {
  firstName: " María José ", lastName: "Pérez", phone: "9 1234 5678",
  region: "Metropolitana de Santiago", comuna: "Ñuñoa", address: "Av. Irarrázaval 1234",
  unit: "Depto 52", notes: "",
};

test("validates and normalizes shipping details", () => {
  assert.deepEqual(validateCustomer(validCustomer), {
    firstName: "María José", lastName: "Pérez", phone: "+56912345678",
    region: "Metropolitana de Santiago", comuna: "Ñuñoa", address: "Av. Irarrázaval 1234",
    unit: "Depto 52", notes: "",
  });
});

test("reports which shipping field is missing", () => {
  for (const [field, patch] of [
    ["firstName", { firstName: "" }],
    ["lastName", { lastName: "123" }],
    ["phone", { phone: "22123456" }],
    ["region", { region: "Santiago" }],
    ["comuna", { comuna: "" }],
    ["address", { address: "Sin número" }],
  ]) {
    assert.throws(() => validateCustomer({ ...validCustomer, ...patch }), (error) => error.field === field);
  }
});

test("sends shipping details to Flow and reads the first name back", () => {
  const optional = flowOptionalData(validateCustomer(validCustomer));
  assert.equal(JSON.parse(optional).Direccion, "Av. Irarrázaval 1234");
  assert.equal(firstNameFromFlowOptional(optional), "María");
  assert.equal(firstNameFromFlowOptional("no es json"), null);
});
