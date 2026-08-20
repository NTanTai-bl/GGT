import { parseStrixOutput } from "../strix-result-parser";

describe("parseStrixOutput", () => {
  it("parses a bare JSON array", () => {
    const stdout = JSON.stringify([{ title: "IDOR" }, { title: "XSS" }]);
    const result = parseStrixOutput(stdout);
    expect(result.parseWarning).toBe(false);
    expect(result.findings).toHaveLength(2);
  });

  it("parses an object with a findings key", () => {
    const stdout = JSON.stringify({ findings: [{ title: "SQLi" }] });
    const result = parseStrixOutput(stdout);
    expect(result.findings).toEqual([{ title: "SQLi" }]);
  });

  it("parses a fenced json block embedded in log output", () => {
    const stdout = [
      "[info] starting scan...",
      "```json",
      JSON.stringify([{ title: "Broken Auth" }]),
      "```",
      "[info] done",
    ].join("\n");
    const result = parseStrixOutput(stdout);
    expect(result.findings).toEqual([{ title: "Broken Auth" }]);
    expect(result.parseWarning).toBe(false);
  });

  it("parses line-delimited JSON findings", () => {
    const stdout = [
      "[info] scanning",
      JSON.stringify({ title: "A" }),
      JSON.stringify({ title: "B" }),
    ].join("\n");
    const result = parseStrixOutput(stdout);
    expect(result.findings).toEqual([{ title: "A" }, { title: "B" }]);
  });

  it("returns no findings with a parse warning for unrecognized output", () => {
    const result = parseStrixOutput("scan complete, no structured output emitted");
    expect(result.findings).toEqual([]);
    expect(result.parseWarning).toBe(true);
  });

  it("returns no findings without a warning for empty output", () => {
    const result = parseStrixOutput("   ");
    expect(result.findings).toEqual([]);
    expect(result.parseWarning).toBe(false);
  });
});
