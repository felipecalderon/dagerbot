import { FastifyReply, FastifyRequest } from "fastify";
import {
  PRIVACY_POLICY,
  TERMS_OF_SERVICE,
  renderPrivacyPolicyHtml,
  renderTermsOfServiceHtml,
} from "../views/legalPages";

export function createLegalController() {
  function wantsJson(request: FastifyRequest): boolean {
    const query = request.query as Record<string, unknown> | undefined;
    if (query && query.format === "json") {
      return true;
    }
    const acceptHeader = request.headers.accept;
    return Boolean(
      acceptHeader &&
        acceptHeader.includes("application/json") &&
        !acceptHeader.includes("text/html")
    );
  }

  async function handlePrivacy(request: FastifyRequest, reply: FastifyReply) {
    if (wantsJson(request)) {
      reply.type("application/json").send(PRIVACY_POLICY);
      return;
    }

    reply.type("text/html; charset=utf-8").send(renderPrivacyPolicyHtml());
  }

  async function handleTerms(request: FastifyRequest, reply: FastifyReply) {
    if (wantsJson(request)) {
      reply.type("application/json").send(TERMS_OF_SERVICE);
      return;
    }

    reply.type("text/html; charset=utf-8").send(renderTermsOfServiceHtml());
  }

  return {
    handlePrivacy,
    handleTerms,
  };
}
