// 변이 실행기 — 별도 git worktree 안에서만 대상 파일을 바꾼다.
//
//   node run-mutants.mjs <worktree 경로> <결과 저장 폴더> [변이 정의 파일=./mutants.mjs]
//
// 변이 정의 파일은 `mutants`(필수)와 `TARGET`(기본 대상)·`TESTS`(실행할 테스트 파일들)를 내보낸다.
// 변이마다 `target` 을 주면 그 파일을 바꾼다.
//
// 판정 규칙 (03-validation.md §변이 판정 기준):
//   검출   — 단언(AssertionError)으로 실패한 테스트가 1건 이상
//   보류   — 실패했지만 단언이 아닌 예외(TypeError 등)뿐 → 사람이 판정, 검출로 세지 않음
//   생존   — 전부 통과
//   무효   — find 가 정확히 1회가 아님 / 테스트 파일 로드 실패 → 검출로 세지 않음
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [worktree, outDir, defsPath = new URL("./mutants.mjs", import.meta.url).pathname] =
  process.argv.slice(2);
if (!worktree || !outDir) {
  console.error("usage: node run-mutants.mjs <worktree> <outDir> [mutants.mjs]");
  process.exit(2);
}
const defs = await import(pathToFileURL(resolve(defsPath)).href);
const TESTS = defs.TESTS ?? ["src/shared/chat/useChat.test.ts"];
const mutants = defs.mutants.map((m) => ({ ...m, target: m.target ?? defs.TARGET }));

const sha = (s) => createHash("sha256").update(s).digest("hex").slice(0, 12);
const targets = [...new Set(mutants.map((m) => m.target))];
const originals = Object.fromEntries(
  targets.map((t) => [t, readFileSync(join(worktree, t), "utf8")]),
);

function runTests(label) {
  const report = join(outDir, `vitest-${label}.json`);
  const proc = spawnSync(
    "npx",
    ["vitest", "run", ...TESTS, "--reporter=json", `--outputFile=${report}`],
    { cwd: worktree, encoding: "utf8", timeout: 120_000 },
  );
  let json;
  try {
    json = JSON.parse(readFileSync(report, "utf8"));
  } catch {
    return { loadError: `리포트 없음 (exit ${proc.status})` };
  }
  const broken = json.testResults.find(
    (f) => f.status === "failed" && f.assertionResults.length === 0,
  );
  if (json.numTotalTests === 0 || broken) {
    return { loadError: broken?.message || "테스트 0건" };
  }
  const failed = json.testResults.flatMap((file) =>
    file.assertionResults
      .filter((t) => t.status === "failed")
      .map((t) => {
        const msg = t.failureMessages.join("\n");
        return {
          name: t.title,
          assertion: /AssertionError/.test(msg),
          firstLine: msg.split("\n")[0].slice(0, 200),
        };
      }),
  );
  return { total: json.numTotalTests, failed };
}

const baseline = runTests("baseline");
if (baseline.loadError || baseline.failed.length) {
  console.error("기준 실행이 통과하지 않음 — 변이를 돌리지 않는다", baseline);
  process.exit(1);
}

const results = [];
for (const m of mutants) {
  const original = originals[m.target];
  const path = join(worktree, m.target);
  const count = original.split(m.find).length - 1;
  if (count !== 1) {
    results.push({ ...m, verdict: "무효", note: `find ${count}회` });
    continue;
  }
  writeFileSync(path, original.replace(m.find, m.replace));
  let r;
  try {
    r = runTests(m.id);
  } finally {
    writeFileSync(path, original); // 실패해도 반드시 원복
  }
  const expectedPrefix = `[${m.scenario}]`;
  let verdict;
  if (r.loadError) verdict = "무효";
  else if (r.failed.some((f) => f.assertion)) verdict = "검출";
  else if (r.failed.length) verdict = "보류";
  else verdict = "생존";
  results.push({
    id: m.id,
    scenario: m.scenario,
    target: m.target,
    desc: m.desc,
    verdict,
    loadError: r.loadError,
    failed: r.failed ?? [],
    byExpectedTest: (r.failed ?? []).some(
      (f) => f.assertion && f.name.startsWith(expectedPrefix),
    ),
  });
  console.log(m.id, verdict);
}

const restored = Object.fromEntries(
  targets.map((t) => {
    const now = readFileSync(join(worktree, t), "utf8");
    return [t, { originalSha: sha(originals[t]), restoredSha: sha(now), identical: now === originals[t] }];
  }),
);
const summary = {
  tests: TESTS,
  restored,
  restoredIdentical: Object.values(restored).every((r) => r.identical),
  baselineTotal: baseline.total,
  results,
};
writeFileSync(join(outDir, "results.json"), JSON.stringify(summary, null, 2));
console.log("원복 확인:", summary.restoredIdentical ? "동일" : "불일치!");
