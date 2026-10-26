import { describe, expect, it } from "vitest";
import { isRelatedCuisine, relatedCuisines } from "@/lib/domain/cuisines";

describe("related cuisines", () => {
  it("links members to their regional family, both ways", () => {
    expect(relatedCuisines("Nigerian")).toEqual(["West African"]);
    expect(relatedCuisines("west african")).toEqual(["Nigerian", "Ghanaian", "Senegalese"]);
    expect(relatedCuisines("Jamaican")).toEqual(["Caribbean"]);
    expect(relatedCuisines("Italian American")).toEqual(["Italian"]);
  });

  it("does not link members of the same family to each other", () => {
    expect(isRelatedCuisine("Senegalese", "Nigerian")).toBe(false);
    expect(isRelatedCuisine("West African", "Nigerian")).toBe(true);
  });

  it("returns nothing for unmapped cuisines", () => {
    expect(relatedCuisines("Chinese")).toEqual([]);
    expect(isRelatedCuisine("African", "Nigerian")).toBe(false);
  });
});
