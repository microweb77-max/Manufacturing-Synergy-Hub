import { ReplitConnectors } from "@replit/connectors-sdk";
import type { Request } from "express";
import { getClerkProxyHost } from "../middlewares/clerkProxyMiddleware";

export function membershipLink(req: Request, token: string) {
  const host = getClerkProxyHost(req);
  if (!host) throw new Error("Application host unavailable");
  const origin = req.get("origin");
  // Origin has already passed same-host validation in the authorization middleware.
  const protocol = origin ? new URL(origin).protocol : host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http:" : "https:";
  return `${protocol}//${host}/company-link#token=${token}`;
}
export async function sendMembershipMail(to: string, companyName: string, link: string, invitation = false) {
  if (!/^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/.test(to)) throw new Error("Invalid recipient");
  const connectors = new ReplitConnectors();
  const profile = await connectors.proxy("google-mail", "/gmail/v1/users/me/profile", { method: "GET" });
  if (!profile.ok) throw new Error("Gmail sender unavailable");
  const { emailAddress } = await profile.json() as { emailAddress: string };
  if (!/^[^\s@<>\r\n]+@[^\s@<>\r\n]+$/.test(emailAddress)) throw new Error("Invalid sender");
  const subject = invitation ? "회사 담당자 초대" : "회사 프로필 인증";
  const text = `${companyName}\n\n${invitation ? "초대받은 이메일이 인증된 계정으로 로그인하여 초대를 수락하세요. 유효기간: 48시간." : "요청한 계정으로 로그인하여 회사 인증을 완료하세요. 유효기간: 30분."}\n\n${link}\n\n요청하지 않은 경우 링크를 열지 마세요. 이 링크는 한 번만 사용할 수 있습니다.`;
  const raw = Buffer.from([
    `From: ${emailAddress}`, `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
    "MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64",
    "", Buffer.from(text).toString("base64"),
  ].join("\r\n")).toString("base64url");
  const response = await connectors.proxy("google-mail", "/gmail/v1/users/me/messages/send", {
    method: "POST", body: { raw },
  });
  // Never automatically retry a send: a lost response may have delivered it.
  if (!response.ok) throw new Error("Gmail send failed");
}