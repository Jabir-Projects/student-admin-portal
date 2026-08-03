// @vitest-environment node

import { describe, expect, it } from "vitest";

import { encodeCsv } from "@/server/administration/exports.node";

describe("V2-6 CSV encoding", () => {
  it("quotes commas, quotes, newlines, and UTF-8 text", () => {
    expect(
      encodeCsv([
        ["Name", "Description"],
        ["Étudiant, Test", 'Said "hello"\nnext line'],
      ]),
    ).toBe(
      '"Name","Description"\r\n"Étudiant, Test","Said ""hello""\nnext line"\r\n',
    );
  });

  it.each([
    "=1+1",
    " +SUM(A1:A2)",
    "-2+3",
    "@command",
    "\tformula",
    "\rformula",
    "\nformula",
  ])("neutralizes spreadsheet formula input %j", (payload) => {
    const csv = encodeCsv([[payload]]);
    expect(csv).toContain(`"'${payload.replaceAll('"', '""')}"`);
  });

  it("does not alter ordinary negative-looking text after safe content", () => {
    expect(encodeCsv([["REQ-00000001"]])).toBe('"REQ-00000001"\r\n');
  });
});
