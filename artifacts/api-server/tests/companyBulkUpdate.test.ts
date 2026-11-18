import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCompanyPatch } from "../src/lib/companyBulkUpdate";

test("blank and omitted values never produce a patch (existing data is preserved)", () => {
  const result = buildCompanyPatch({
    id: 1, name: "", taxCode: "  ", phone: "", kakaoTalkId: "", description: "", location: "",
    techSpecs: "", contactEmail: "", capabilityTags: [],
  });
  assert.deepEqual(result, { patch: {} });
  assert.deepEqual(buildCompanyPatch({ id: 1 }), { patch: {} });
});

test("only provided columns are written, values are trimmed", () => {
  assert.deepEqual(buildCompanyPatch({ id: 1, taxCode: " 0312345678 " }), { patch: { taxCode: "0312345678" } });
});

test("capability tags are trimmed, de-duplicated and blanks dropped", () => {
  assert.deepEqual(buildCompanyPatch({ id: 1, capabilityTags: [" 용접", "열처리 ", "", "용접"] }), { patch: { capabilityTags: ["용접", "열처리"] } });
});

test("explicit (비움) clears nullable and text fields; name cannot be cleared", () => {
  assert.deepEqual(buildCompanyPatch({ id: 1, taxCode: "(비움)", description: "(비움)", capabilityTags: ["(비움)"] }),
    { patch: { taxCode: null, description: "", capabilityTags: [] } });
  assert.ok("error" in buildCompanyPatch({ id: 1, name: "(비움)" }));
  assert.ok("error" in buildCompanyPatch({ id: 1, capabilityTags: ["용접", "(비움)"] }));
});
