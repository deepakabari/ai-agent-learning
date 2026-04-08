import { describe, it, expect } from "vitest";
import { buildApp } from "../app.js";

describe("App", () => {
  it("should build without crashing", async () => {
    const app = await buildApp();
    expect(app).toBeDefined();
    await app.close();
  });

  it("should have the health check route", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/healthz",
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok" });
    await app.close();
  });
});
