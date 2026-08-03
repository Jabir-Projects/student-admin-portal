import type {
  NotificationEventType,
  PreferredLanguage,
  RequestStatus,
} from "@/generated/prisma/client";

export type NotificationTemplateInput = {
  eventType: NotificationEventType;
  preferredLanguage: PreferredLanguage | string | null | undefined;
  portalUrl: string;
  status?: RequestStatus | null;
};

export type RenderedNotificationEmail = {
  subject: string;
  text: string;
  html: string;
};

const statusLabels: Record<PreferredLanguage, Record<RequestStatus, string>> = {
  ENGLISH: {
    SUBMITTED: "submitted",
    UNDER_REVIEW: "under review",
    APPROVED: "approved",
    REJECTED: "rejected",
    READY: "ready",
    COMPLETED: "completed",
    CANCELLED: "cancelled",
  },
  FRENCH: {
    SUBMITTED: "soumise",
    UNDER_REVIEW: "en cours d’examen",
    APPROVED: "approuvée",
    REJECTED: "rejetée",
    READY: "prête",
    COMPLETED: "terminée",
    CANCELLED: "annulée",
  },
  ARABIC: {
    SUBMITTED: "مُرسَل",
    UNDER_REVIEW: "قيد المراجعة",
    APPROVED: "مقبول",
    REJECTED: "مرفوض",
    READY: "جاهز",
    COMPLETED: "مكتمل",
    CANCELLED: "ملغى",
  },
};

function language(
  value: NotificationTemplateInput["preferredLanguage"],
): PreferredLanguage {
  return value === "FRENCH" || value === "ARABIC" ? value : "ENGLISH";
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/gu,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ] ?? character,
  );
}

export function renderNotificationEmail(
  input: NotificationTemplateInput,
): RenderedNotificationEmail {
  const selected = language(input.preferredLanguage);
  const status = input.status
    ? statusLabels[selected][input.status]
    : undefined;
  const copy = {
    ENGLISH: {
      subject: "SIST portal notification",
      status: `The status of your request is now ${status ?? "updated"}.`,
      message: "A new public message is available for your request.",
      action: "Sign in to the SIST portal to view the update.",
      link: "Open the SIST portal",
    },
    FRENCH: {
      subject: "Notification du portail SIST",
      status: `Le statut de votre demande est maintenant ${status ?? "mis à jour"}.`,
      message: "Un nouveau message public est disponible pour votre demande.",
      action: "Connectez-vous au portail SIST pour consulter la mise à jour.",
      link: "Ouvrir le portail SIST",
    },
    ARABIC: {
      subject: "إشعار بوابة SIST",
      status: `حالة طلبك الآن: ${status ?? "محدّثة"}.`,
      message: "تتوفر رسالة عامة جديدة بخصوص طلبك.",
      action: "سجّل الدخول إلى بوابة SIST للاطلاع على التحديث.",
      link: "فتح بوابة SIST",
    },
  }[selected];
  const summary =
    input.eventType === "REQUEST_STATUS_CHANGED" ? copy.status : copy.message;
  const direction = selected === "ARABIC" ? "rtl" : "ltr";
  return {
    subject: copy.subject,
    text: `${summary}\n\n${copy.action}\n${input.portalUrl}`,
    html: `<div dir="${direction}"><p>${escapeHtml(summary)}</p><p>${escapeHtml(copy.action)}</p><p><a href="${escapeHtml(input.portalUrl)}">${escapeHtml(copy.link)}</a></p></div>`,
  };
}
