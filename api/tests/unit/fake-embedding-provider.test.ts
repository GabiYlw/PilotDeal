import { describe, expect, it } from "vitest";
import {
  FAKE_OTHER_DIMENSION,
  FakeEmbeddingProvider,
  fakeEmbedding,
} from "../support/fake-embedding-provider.js";

function dot(a: number[], b: number[]): number {
  return a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0);
}

describe("fakeEmbedding", () => {
  it.each([
    ["a keyword text", "price budget"],
    ["a text without keywords", "hello world"],
    ["an empty string", ""],
  ])("returns 384 numbers with an L2 norm of 1 for %s", (_name, text) => {
    const vector = fakeEmbedding(text);

    expect(vector).toHaveLength(384);
    expect(Math.sqrt(dot(vector, vector))).toBeCloseTo(1, 9);
  });

  it.each([
    ["a text without keywords", "hello world"],
    ["an empty string", ""],
  ])("puts all weight on the other dimension for %s", (_name, text) => {
    const vector = fakeEmbedding(text);

    expect(FAKE_OTHER_DIMENSION).toBe(6);
    expect(vector[6]).toBe(1);
    expect(vector.filter((value, index) => index !== 6 && value !== 0)).toEqual([]);
  });

  it.each([
    ["price", 1],
    ["price budget", 0.707],
    ["price budget timeline", 0.577],
    ["price budget budget budget", 0.316],
    ["price budget budget budget budget", 0.243],
    ["budget", 0],
    ["hello world", 0],
    ["pricing prices", 0],
  ])("has cosine similarity to the question price for note '%s' of %f", (note, expected) => {
    expect(dot(fakeEmbedding("price"), fakeEmbedding(note))).toBeCloseTo(expected, 3);
  });
});

describe("FakeEmbeddingProvider", () => {
  it("records calls and fails until reset", async () => {
    const provider = new FakeEmbeddingProvider();
    provider.failWith(new Error("boom"));

    await expect(provider.embed(["a"])).rejects.toThrow("boom");
    provider.reset();

    expect(provider.calls).toEqual([]);
    await expect(provider.embed(["price"])).resolves.toEqual([fakeEmbedding("price")]);
    expect(provider.calls).toEqual([["price"]]);
  });
});
