// I-8 · I-9 변이 — 기존 세트와 별도 집계.
// 의미는 테스트 작성 전(06-fix-plan "I-8 · I-9 설계")에 고정, 문자열은 구현 뒤·실행 전에 씀(2026-11-07).
// N7 은 "닫은 뒤에도 입구 유지"를 개수가 줄지 않는 캐시로 구현했다(처음 본 최대 개수를 유지).

export const TESTS = ["src/features/seller/ChatPage.test.tsx"];

const PAGE = "src/features/seller/ChatPage.tsx";
const WORKSPACE = "src/features/seller/components/SellerWorkspace.tsx";

export const mutants = [
  { id: "N1", scenario: "I-8", target: PAGE, desc: "새 초안 때 모바일을 채팅으로 되돌림(구 동작)",
    find: '      setPanelIntent("results");\n      setMobileView("results");\n    },', replace: '      setPanelIntent("results");\n      setMobileView("chat");\n    },' },
  { id: "N2", scenario: "I-8·I-9", target: PAGE, desc: "초안 보기가 결과 패널을 열지 않음",
    find: '  const openDrafts = () => {\n    setPanelIntent("results");\n', replace: "  const openDrafts = () => {\n" },
  { id: "N3", scenario: "I-8", target: PAGE, desc: "초안 보기가 작업 영역으로 옮기지 않음",
    find: '    setPanelIntent("results");\n    setMobileView("results");\n  };', replace: '    setPanelIntent("results");\n  };' },
  { id: "N4", scenario: "I-9", target: WORKSPACE, desc: "초안이 없어도 목록 입구 표시",
    find: "{onOpenDrafts && draftResults.length > 0 && (", replace: "{onOpenDrafts && draftResults.length >= 0 && (" },
  { id: "N5", scenario: "I-9", target: WORKSPACE, desc: "결과를 보는 중에도 입구 표시",
    find: '          <div className="flex flex-col gap-6">\n',
    replace: '          <div className="flex flex-col gap-6">\n            {onOpenDrafts && <DraftEntryButton count={draftResults.length} onClick={onOpenDrafts} />}\n' },
  { id: "N6", scenario: "I-9", target: PAGE, desc: "입구가 목록 강제(list)를 결과로 풀지 않음",
    find: '  const openDrafts = () => {\n    setPanelIntent("results");\n', replace: '  const openDrafts = () => {\n    setPanelIntent("auto");\n' },
  { id: "N7", scenario: "I-9", target: PAGE, desc: "초안을 닫아도 개수·입구가 줄지 않음(최대값 유지)",
    find: '  const draftCount = results.filter((r) => r.kind === "draft").length;\n',
    replace: '  const maxDraftRef = useRef(0);\n  maxDraftRef.current = Math.max(maxDraftRef.current, results.filter((r) => r.kind === "draft").length);\n  const draftCount = maxDraftRef.current;\n' },
  { id: "N8", scenario: "I-9", target: WORKSPACE, desc: "결과 패널이 첫 초안만 그림",
    find: "{draftResults.map((r, i) =>", replace: "{draftResults.slice(0, 1).map((r, i) =>" },
  { id: "N9", scenario: "I-9", target: PAGE, desc: "초안이 있으면 results 변화마다 패널 자동 열기",
    find: '  const draftCount = results.filter((r) => r.kind === "draft").length;\n',
    replace: '  const draftCount = results.filter((r) => r.kind === "draft").length;\n  useEffect(() => {\n    if (results.some((r) => r.kind === "draft")) setPanelIntent("results");\n  }, [results]);\n' },
  { id: "N10", scenario: "I-8 접근성", target: PAGE, desc: "결과를 보는 중에도 작업 탭을 현재로 표시",
    find: ': mobileView !== "chat" && !showResults && workspaceTab === t.key;', replace: ': mobileView !== "chat" && workspaceTab === t.key;' },
];
