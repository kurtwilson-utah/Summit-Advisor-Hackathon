import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./config";

export interface SignedAccessSession {
  email: string;
  displayName: string;
  accessToken: string;
}

interface AccessTokenPayload {
  email: string;
  displayName: string;
  issuedAt: string;
}

export function createAccessSessionSigner() {
  const secret = env.ACCESS_GATE_SECRET || env.SUPABASE_SERVICE_ROLE_KEY || env.ANTHROPIC_API_KEY || "local-dev-access-gate";

  return {
    sign(args: { email: string; displayName: string }): SignedAccessSession {
      const payload: AccessTokenPayload = {
        email: args.email,
        displayName: args.displayName,
        issuedAt: new Date().toISOString()
      };
      const encodedPayload = encodeBase64Url(JSON.stringify(payload));
      const signature = signValue(secret, encodedPayload);

      return {
        ...args,
        accessToken: `${encodedPayload}.${signature}`
      };
    },
    verify(session: SignedAccessSession) {
      const [encodedPayload, signature] = session.accessToken.split(".");

      if (!encodedPayload || !signature) {
        return false;
      }

      const expectedSignature = signValue(secret, encodedPayload);
      const providedSignatureBuffer = Buffer.from(signature);
      const expectedSignatureBuffer = Buffer.from(expectedSignature);

      if (providedSignatureBuffer.length !== expectedSignatureBuffer.length) {
        return false;
      }

      const signaturesMatch = timingSafeEqual(providedSignatureBuffer, expectedSignatureBuffer);

      if (!signaturesMatch) {
        return false;
      }

      const payload = JSON.parse(decodeBase64Url(encodedPayload)) as AccessTokenPayload;

      return payload.email === session.email && payload.displayName === session.displayName;
    }
  };
}

function signValue(secret: string, value: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}
