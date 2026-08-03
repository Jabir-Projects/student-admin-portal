import { describe, expect, it } from "vitest";

import {
  auditListQuerySchema,
  notificationListQuerySchema,
} from "@/features/notifications/schemas";
import { renderNotificationEmail } from "@/features/notifications/templates";

describe("notification and audit input schemas", () => {
  it("applies safe pagination defaults and limits", () => {
    expect(notificationListQuerySchema.parse({})).toEqual({ page: 1 });
    expect(auditListQuerySchema.parse({})).toMatchObject({
      page: 1,
      pageSize: 25,
    });
    expect(auditListQuerySchema.safeParse({ pageSize: 51 }).success).toBe(
      false,
    );
  });

  it("rejects reversed dates and safely drops malformed optional filters", () => {
    expect(
      auditListQuerySchema.safeParse({
        dateFrom: "2026-08-04",
        dateTo: "2026-08-03",
      }).success,
    ).toBe(false);
    expect(
      auditListQuerySchema.parse({
        action: "x".repeat(121),
        dateFrom: "not-a-date",
      }),
    ).toMatchObject({ action: undefined, dateFrom: undefined });
  });
});

describe("version-controlled notification templates", () => {
  it.each([
    ["ENGLISH", "SIST portal notification"],
    ["FRENCH", "Notification du portail SIST"],
    ["ARABIC", "إشعار بوابة SIST"],
  ] as const)(
    "renders safe text and HTML for %s",
    (preferredLanguage, subject) => {
      const result = renderNotificationEmail({
        eventType: "REQUEST_STATUS_CHANGED",
        preferredLanguage,
        portalUrl: "https://portal.example.test/student/requests/test",
        status: "APPROVED",
      });
      expect(result.subject).toBe(subject);
      expect(result.text).toContain("https://portal.example.test/");
      expect(result.html).toContain("<a href=");
      expect(`${result.subject}${result.text}${result.html}`).not.toMatch(
        /student number|internal note|password|token|stack/iu,
      );
    },
  );

  it("uses English fallback and escapes link attributes", () => {
    const result = renderNotificationEmail({
      eventType: "REQUEST_PUBLIC_MESSAGE_ADDED",
      preferredLanguage: "UNSUPPORTED",
      portalUrl: 'https://portal.example.test/?value="unsafe"',
    });
    expect(result.subject).toBe("SIST portal notification");
    expect(result.html).toContain("&quot;unsafe&quot;");
    expect(result.html).not.toContain(
      'href="https://portal.example.test/?value="unsafe"',
    );
  });
});
