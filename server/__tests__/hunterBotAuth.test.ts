import { afterEach, describe, expect, it } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { requireHunterBot } from "../editorAuth";

const originalToken = process.env.HUNTER_BOT_API_TOKEN;

afterEach(() => {
  if (originalToken === undefined) delete process.env.HUNTER_BOT_API_TOKEN;
  else process.env.HUNTER_BOT_API_TOKEN = originalToken;
});

function invoke(authorization?: string) {
  let status = 200;
  let body: unknown;
  let nextCalled = false;
  const req = { headers: authorization ? { authorization } : {} } as Request;
  const res = {
    status(code: number) {
      status = code;
      return this;
    },
    json(value: unknown) {
      body = value;
      return this;
    },
  } as unknown as Response;
  const next = (() => {
    nextCalled = true;
  }) as NextFunction;
  requireHunterBot(req, res, next);
  return { status, body, nextCalled };
}

describe("Hunter bot authentication", () => {
  it("accepts the configured Bearer token", () => {
    process.env.HUNTER_BOT_API_TOKEN = "test-bot-token";
    expect(invoke("Bearer test-bot-token")).toMatchObject({
      status: 200,
      nextCalled: true,
    });
  });

  it("rejects missing, malformed, and incorrect tokens", () => {
    process.env.HUNTER_BOT_API_TOKEN = "test-bot-token";
    expect(invoke()).toMatchObject({ status: 401, nextCalled: false });
    expect(invoke("test-bot-token")).toMatchObject({ status: 401, nextCalled: false });
    expect(invoke("Bearer wrong-token")).toMatchObject({ status: 401, nextCalled: false });
  });

  it("fails closed when the server token is not configured", () => {
    delete process.env.HUNTER_BOT_API_TOKEN;
    expect(invoke("Bearer anything")).toMatchObject({ status: 401, nextCalled: false });
  });
});