import express from "express";
import request from "supertest";
import { uuidParam } from "../middleware/validateParams";

describe("uuidParam", () => {
  const app = express();
  const router = express.Router();
  router.param("id", uuidParam);
  router.get("/:id", (req, res) => {
    res.json({ id: req.params.id });
  });
  app.use("/items", router);

  it("answers 404 for a malformed id instead of letting Postgres raise a 500", async () => {
    const res = await request(app).get("/items/not-a-uuid");
    expect(res.status).toBe(404);
  });

  it("passes a well-formed UUID through", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const res = await request(app).get(`/items/${id}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id });
  });
});
