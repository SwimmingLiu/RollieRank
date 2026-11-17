import test from "node:test";
import assert from "node:assert/strict";
import { discussionTextParts, extractDiscussionLinks } from "../docs/ui-exploration/ios-v3/features/discussions.js";

test("comment URLs trim prose punctuation, preserve balanced paths and deduplicate canonical links", () => {
  const text = "看（https://EXAMPLE.com/a?q=1）。再看 https://example.com/a?q=1，或 http://example.org/file_(x)).";
  const parts = discussionTextParts(text);
  assert.equal(parts.map((part) => part.text).join(""), text);
  assert.deepEqual(extractDiscussionLinks(text), ["https://example.com/a?q=1", "http://example.org/file_(x)"]);
  assert.equal(parts.filter((part) => part.kind === "link").length, 3);
});

test("unusable or non-HTTP text stays literal while valid links retain normalized addresses", () => {
  const text = "javascript:alert(1) https://user:pass@example.com/a https:// HTTPS://example.org/。";
  assert.deepEqual(extractDiscussionLinks(text), ["https://example.org/"]);
  assert.equal(discussionTextParts(text).map((part) => part.text).join(""), text);
  assert.deepEqual(discussionTextParts("只有文字"), [{ kind: "text", text: "只有文字" }]);
});

test("automatic recognition keeps all distinct links for the existing submission limit to validate", () => {
  assert.equal(extractDiscussionLinks("https://a.example https://b.example https://c.example https://d.example").length, 4);
});
