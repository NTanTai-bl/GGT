import { normalizeFinding } from "../finding-normalizer";

describe("normalizeFinding", () => {
  it("maps common field aliases into the internal schema", () => {
    const result = normalizeFinding({
      name: "Invoice IDOR",
      risk: "high",
      type: "Broken Access Control",
      desc: "Any user can fetch any invoice by incrementing the id.",
      url: "/api/invoices/{id}",
      http_method: "get",
    });
    expect(result.title).toBe("Invoice IDOR");
    expect(result.severity).toBe("HIGH");
    expect(result.category).toBe("Broken Access Control");
    expect(result.endpoint).toBe("/api/invoices/{id}");
    expect(result.method).toBe("GET");
  });

  it("defaults severity to INFO for unrecognized values instead of throwing", () => {
    const result = normalizeFinding({ title: "Something", severity: "made-up-level" });
    expect(result.severity).toBe("INFO");
  });

  it("maps severity synonyms", () => {
    expect(normalizeFinding({ title: "a", severity: "severe" }).severity).toBe("CRITICAL");
    expect(normalizeFinding({ title: "a", severity: "moderate" }).severity).toBe("MEDIUM");
    expect(normalizeFinding({ title: "a", severity: "minor" }).severity).toBe("LOW");
  });

  it("produces the same fingerprint for the same title/category/endpoint/method", () => {
    const a = normalizeFinding({ title: "IDOR", category: "BAC", endpoint: "/x", method: "GET" });
    const b = normalizeFinding({ title: "IDOR", category: "BAC", endpoint: "/x", method: "get" });
    expect(a.fingerprint).toBe(b.fingerprint);
  });

  it("produces a different fingerprint when the endpoint differs", () => {
    const a = normalizeFinding({ title: "IDOR", endpoint: "/x" });
    const b = normalizeFinding({ title: "IDOR", endpoint: "/y" });
    expect(a.fingerprint).not.toBe(b.fingerprint);
  });
});
