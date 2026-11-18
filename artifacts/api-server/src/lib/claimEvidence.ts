import { Storage } from "@google-cloud/storage";
import { randomUUID } from "node:crypto";
import { MembershipError } from "./membershipTokens";

const storage = new Storage({
  credentials: {
    audience: "replit", subject_token_type: "access_token",
    token_url: "http://127.0.0.1:1106/token", type: "external_account",
    credential_source: { url: "http://127.0.0.1:1106/credential", format: { type: "json", subject_token_field_name: "access_token" } },
    universe_domain: "googleapis.com",
  }, projectId: "",
});
function evidenceFile(path: string) {
  const privateDir = process.env.PRIVATE_OBJECT_DIR;
  if (!privateDir || !path.startsWith(`${privateDir}/company-claims/`)) throw new Error("Invalid private evidence path");
  const [bucket, ...parts] = path.replace(/^\//, "").split("/");
  return storage.bucket(bucket).file(parts.join("/"));
}
export async function saveEvidence(dataUrl: string) {
  const match = /^data:(image\/png|image\/jpeg|application\/pdf);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) throw new MembershipError(400, "PNG, JPG 또는 PDF 증빙을 첨부하세요.");
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0 || bytes.length > 5 * 1024 * 1024) throw new MembershipError(400, "증빙은 최대 5MB입니다.");
  const mime = match[1];
  const magicOk = mime === "application/pdf" ? bytes.subarray(0, 5).toString() === "%PDF-"
    : mime === "image/png" ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (!magicOk) throw new MembershipError(400, "첨부 파일 형식이 올바르지 않습니다.");
  if (!process.env.PRIVATE_OBJECT_DIR) throw new Error("Private object storage unavailable");
  const path = `${process.env.PRIVATE_OBJECT_DIR}/company-claims/${randomUUID()}`;
  await evidenceFile(path).save(bytes, { resumable: false, metadata: { contentType: mime } });
  return path;
}
export async function readEvidence(path: string) {
  const file = evidenceFile(path);
  const [metadata] = await file.getMetadata();
  const [bytes] = await file.download();
  return { bytes, mime: metadata.contentType ?? "application/octet-stream" };
}