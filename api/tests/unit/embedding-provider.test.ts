import { describe, expect, it } from "vitest";
import {
  EmbeddingOutputError,
  type EmbeddingProvider,
  embedText,
  embedTexts,
} from "../../src/ai/embedding-provider.js";

function providerReturning(vectors: number[][], dimensions = 3): EmbeddingProvider {
  return { dimensions, embed: () => Promise.resolve(vectors) };
}

describe("embedTexts", () => {
  it("returns the vectors of a well-formed provider and calls embed once with the texts", async () => {
    const calls: string[][] = [];
    const provider: EmbeddingProvider = {
      dimensions: 2,
      embed: (texts) => {
        calls.push(texts);
        return Promise.resolve(texts.map(() => [0.5, -0.5]));
      },
    };

    await expect(embedTexts(provider, ["a", "b"])).resolves.toEqual([
      [0.5, -0.5],
      [0.5, -0.5],
    ]);
    expect(calls).toEqual([["a", "b"]]);
  });

  it("resolves [] for an empty input", async () => {
    await expect(embedTexts(providerReturning([]), [])).resolves.toEqual([]);
  });

  it.each([
    ["too few vectors", [[1, 2, 3]]],
    [
      "too many vectors",
      [
        [1, 2, 3],
        [1, 2, 3],
        [1, 2, 3],
      ],
    ],
    [
      "a vector that is too short",
      [
        [1, 2, 3],
        [1, 2],
      ],
    ],
    [
      "a vector that is too long",
      [
        [1, 2, 3],
        [1, 2, 3, 4],
      ],
    ],
    [
      "a NaN element",
      [
        [1, 2, 3],
        [1, Number.NaN, 3],
      ],
    ],
    [
      "an Infinity element",
      [
        [1, 2, 3],
        [1, 2, Number.POSITIVE_INFINITY],
      ],
    ],
  ])("rejects with EmbeddingOutputError for %s", async (_name, vectors) => {
    await expect(embedTexts(providerReturning(vectors), ["a", "b"])).rejects.toBeInstanceOf(
      EmbeddingOutputError,
    );
  });

  it("propagates a provider rejection unchanged", async () => {
    const failure = new Error("boom");
    const provider: EmbeddingProvider = { dimensions: 3, embed: () => Promise.reject(failure) };

    await expect(embedTexts(provider, ["a"])).rejects.toBe(failure);
  });
});

describe("embedText", () => {
  it("returns the single vector", async () => {
    await expect(embedText(providerReturning([[1, 2, 3]]), "a")).resolves.toEqual([1, 2, 3]);
  });

  it("rejects with EmbeddingOutputError when the provider returns no vector", async () => {
    await expect(embedText(providerReturning([]), "a")).rejects.toBeInstanceOf(
      EmbeddingOutputError,
    );
  });

  it("rejects with an error named EmbeddingOutputError", async () => {
    await expect(embedText(providerReturning([[1]]), "a")).rejects.toMatchObject({
      name: "EmbeddingOutputError",
    });
  });
});
