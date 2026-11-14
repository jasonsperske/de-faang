// The doctor script is plain JS (it must run before `npm install`), so it keeps its own copy of the
// toolchain list. These checks keep it in sync with the runner and with `npm run docker:pull`.
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { LOCAL_IMAGES, RUNTIMES } from "../server/runner/execute.ts";
// @ts-expect-error plain .mjs without type declarations
import { DEV_IMAGE as DOCTOR_DEV_IMAGE, LOCAL_IMAGES as DOCTOR_LOCAL_IMAGES, TOOLCHAINS } from "../scripts/doctor.mjs";
import { DEV_IMAGE } from "../server/debug/app.ts";

describe("doctor", () => {
  it("checks the same image for every language as the runner", () => {
    const doctor = Object.fromEntries(Object.entries(TOOLCHAINS as Record<string, { image: string }>).map(([l, t]) => [l, t.image]));
    const runner = Object.fromEntries(Object.entries(RUNTIMES).map(([l, r]) => [l, r.image]));
    expect(doctor).toEqual(runner);
    expect(DOCTOR_LOCAL_IMAGES).toEqual(LOCAL_IMAGES);
    expect(DOCTOR_DEV_IMAGE).toBe(DEV_IMAGE);
  });

  it("is covered by npm run docker:pull", () => {
    const pull = JSON.parse(fs.readFileSync("package.json", "utf8")).scripts["docker:pull"] as string;
    for (const { image } of Object.values(RUNTIMES)) expect(pull, image).toContain(image);
    for (const [image, dir] of Object.entries(LOCAL_IMAGES)) expect(pull, image).toContain(`docker build -t ${image} ${dir}`);
  });
});
