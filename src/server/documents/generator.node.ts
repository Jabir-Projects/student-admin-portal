import "server-only";
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import {
  MAX_DOCUMENT_BYTES,
  checksumDocument,
} from "@/server/documents/storage.node";
export type RequestFulfilmentData = Readonly<{
  id: string;
  version: number;
  referenceNumber: string;
  category: string;
  fullName: string;
  studentNumber: string;
  program: string;
  academicYear: string;
  issueDate: string;
}>;
export async function generateRequestFulfilmentPdf(
  data: RequestFulfilmentData,
) {
  const issuedAt = new Date(`${data.issueDate}T00:00:00.000Z`);
  const details = [
    ["Request reference", data.referenceNumber],
    ["Request category", data.category],
    ["Student", data.fullName],
    ["Student number", data.studentNumber],
    ["Academic program", data.program],
    ["Academic year", data.academicYear],
    ["Issue date", data.issueDate],
    ["Document ID", data.id],
    ["Version", String(data.version)],
  ];
  const document = React.createElement(
    Document,
    {
      title: "Request Fulfilment Document",
      author: "SIST",
      creator: "SIST Student Services and Administration Portal",
      producer: "SIST Student Services and Administration Portal",
      creationDate: issuedAt,
      modificationDate: issuedAt,
    },
    React.createElement(
      Page,
      { size: "A4", style: { padding: 48, fontSize: 11 } },
      React.createElement(
        View,
        null,
        React.createElement(
          Text,
          { style: { fontSize: 18, marginBottom: 16 } },
          "SIST Student Services and Administration Portal",
        ),
        React.createElement(
          Text,
          { style: { fontSize: 16, marginBottom: 20 } },
          "Request Fulfilment Document",
        ),
        ...details.map(([label, value]) =>
          React.createElement(
            Text,
            { key: label, style: { marginBottom: 5 } },
            `${label}: ${value}`,
          ),
        ),
        React.createElement(
          Text,
          { style: { marginTop: 18 } },
          "This document confirms that the request referenced above has been processed through the SIST Student Services and Administration Portal.",
        ),
        React.createElement(
          Text,
          { style: { marginTop: 28, fontSize: 9 } },
          "System-generated document. Valid only when obtained through the authenticated SIST portal.",
        ),
      ),
    ),
  );
  const bytes = new Uint8Array(await renderToBuffer(document));
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_DOCUMENT_BYTES)
    throw new Error("Generated document is invalid.");
  return {
    bytes,
    checksum: checksumDocument(bytes),
    filename: `sist-request-${data.referenceNumber.replace(/[^A-Za-z0-9-]/gu, "")}-v${data.version}.pdf`,
  };
}
