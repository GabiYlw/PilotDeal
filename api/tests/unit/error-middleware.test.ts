import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { errorMiddleware, notFoundHandler } from "../../src/shared/error-middleware.js";
import { NotFoundError, ValidationError } from "../../src/shared/errors.js";

function createAppThatThrows(error: unknown): express.Express {
  const app = express();
  app.use(express.json());
  app.get("/boom", () => {
    throw error;
  });
  app.post("/echo", (req, res) => {
    res.json(req.body);
  });
  app.use(notFoundHandler);
  app.use(errorMiddleware);
  return app;
}

describe("errorMiddleware", () => {
  it("maps a ValidationError to 400 with its details", async () => {
    const details = [{ path: ["name"], message: "Required" }];
    const app = createAppThatThrows(new ValidationError("Invalid request", details));

    const response = await request(app).get("/boom");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: { code: "VALIDATION_ERROR", message: "Invalid request", details },
    });
  });

  it("maps a NotFoundError to 404 without details", async () => {
    const app = createAppThatThrows(new NotFoundError("Deal 42 not found"));

    const response = await request(app).get("/boom");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: "NOT_FOUND", message: "Deal 42 not found" } });
  });

  it("returns 404 with the error shape for an unknown route", async () => {
    const response = await request(createAppThatThrows(null)).get("/does-not-exist");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { code: "NOT_FOUND", message: "Route GET /does-not-exist not found" },
    });
  });

  it("returns 400 when the request body is malformed JSON", async () => {
    const response = await request(createAppThatThrows(null))
      .post("/echo")
      .set("Content-Type", "application/json")
      .send("{not json");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: { code: "VALIDATION_ERROR", message: "Request body is not valid JSON" },
    });
  });

  it("hides unexpected errors behind a generic 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const app = createAppThatThrows(new Error("secret stack detail"));

    const response = await request(app).get("/boom");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: { code: "INTERNAL_ERROR", message: "Internal server error" },
    });
  });
});
