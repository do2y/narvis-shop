// 개발자 라운드 2회차 — D3·D5·D6 테스트 보강 뒤 재검증(2026-11-09). 1회차(5/8)와 따로 집계한다.
// 변이 정의는 1회차 파일(mutants-d.mjs)을 그대로 가져온다 — 문자열·의미를 바꾸지 않는다.
import { mutants as round1 } from "./mutants-d.mjs";

export const TESTS = ["src"];
export const mutants = round1.filter((m) => ["D3", "D5", "D6"].includes(m.id));
