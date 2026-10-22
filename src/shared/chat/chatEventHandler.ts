import { resolveAnalysisReport } from "@/shared/chat/analysisReport";
import { resolveChatErrorMessage } from "@/shared/chat/errorMessage";
import { fetchChatListGroup } from "@/shared/chat/lists";
import { resolveProgressText } from "@/shared/chat/progress";
import type {
  ChatAction,
  ChatEvent,
  SellerPanel,
  SellerReport,
} from "@/shared/types/chat";
import { useChatStore } from "./store";

interface TurnHandlerOptions {
  /** 채널별 액션 후처리(장바구니 invalidate 등). 안내 문구 표시는 여기서 공통 처리한다. */
  onAction?: (action: ChatAction) => void;
  /** 스트림 정상 종료 시 우측 패널 조치(판매자 전용). error 로 끝나면 호출되지 않는다. */
  onDone?: (panel: SellerPanel | undefined) => void;
}

/**
 * SSE 이벤트를 스토어에 반영하는 핸들러를 **턴(스트림 1회)마다 새로** 만든다.
 *
 * useChat 에서 떼어 낸 이유: 이벤트 11종의 처리 규칙(report 는 done 까지 보류,
 * token 은 진행 표시를 지우지 않음 등)이 계약의 핵심인데, 훅 안에 있으면
 * "이 순서로 이벤트가 오면 상태가 이렇게 된다"를 테스트할 수 없었다.
 *
 * 턴 단위로 만드는 이유: 아래 세 값은 스트림 1회 수명이다. 턴을 넘어 살아남으면
 * 이전 턴의 리포트·조회가 다음 턴 결과로 샌다.
 */
export function createTurnHandler({ onAction, onDone }: TurnHandlerOptions) {
  const {
    appendToLastAssistant,
    failLastAssistant,
    setResults,
    addResult,
    settleDraft,
    setConditions,
    setSuggestions,
    setLane,
    setProgress,
    setAnalysisReport,
    setActiveDraft,
  } = useChatStore.getState();

  // 한 응답 안에서 여러 결과 이벤트가 올 수 있다. 첫 결과가 도착할 때
  // 이전 턴의 결과를 비우고, 그 뒤부터는 누적한다.
  let replacedResults = false;
  const pushResult: typeof addResult = (result) => {
    if (!replacedResults) {
      replacedResults = true;
      setResults([result]);
      return;
    }
    addResult(result);
  };

  // products.ready(경로 B)의 CH-5 조회는 비동기다. 스트림 종료(finally) 전에
  // 완료를 보장하려고 promise 를 모아 두고 스트림 소비 후 함께 기다린다.
  const pendingFetches: Promise<void>[] = [];

  // 분석 리포트 보관함 — 스트림 1회 수명(이 핸들러와 같다).
  // report 수신 즉시 패널에 꽂지 않고 여기 담아 두는 이유는 done 절 주석 참조.
  let pendingReport: SellerReport | null = null;

  const onEvent = (e: ChatEvent) => {
    switch (e.type) {
      case "meta":
        // 첫 프레임 — 레인으로 즉시 레이아웃·로딩 준비
        setLane(e.data.lane);
        // 새 분석이 시작되면 이전 리포트를 비운다(스켈레톤부터 다시 시작).
        // 보관함도 함께 턴다 — 이전 스트림이 report 만 보내고 done 없이
        // 끊겼다면 남아 있을 수 있는데, 그게 다음 턴 결과로 새면 안 된다.
        if (e.data.lane === "analysis") {
          setAnalysisReport(null);
          pendingReport = null;
        }
        break;
      case "progress": {
        // 진행 상태(최종 답변 아님). 두 스트림의 페이로드가 다르다 —
        // 구매자 {stage, message?} / 판매자 {text}. 쉐이프를 맞추는 건 후속 과제라
        // 지금은 수신부가 분기한다(계약 CH-2 §progress, 2026-08-05 #289).
        //
        // 구매자는 message 가 없으면 stage 로 자체 문구를 매핑한다 —
        // 서버가 빈 값이면 키 자체를 싣지 않기로 계약이 위임한 지점이다.
        // 문구를 못 구한 경우(모르는 stage + message 없음)는 무시한다 — 계약이
        // "FE 는 모르는 stage 를 무시한다"로 정한 지점이다. null 로 덮으면
        // 직전 단계 문구까지 지워져 진행 표시가 도리어 후퇴한다.
        const text = resolveProgressText(e.data);
        if (text) setProgress(text);
        break;
      }
      case "token":
        // 진행 표시를 지우지 않는다 — publishing 은 근거 token 뒤에 오므로
        // 여기서 지우면 7종 중 그 한 종이 영영 화면에 닿지 못한다(계약 CH-2 §progress).
        // 정리는 done·finally 가 맡는다.
        appendToLastAssistant(e.data.text);
        break;
      case "conditions":
        // AI 추출 조건 칩(제거 가능). 새 턴이 오면 이전 칩을 덮어쓴다.
        setConditions(e.data.chips);
        break;
      case "suggestions":
        // 완화·되돌리기 제안 칩. estCount==0 은 방어적으로 제외.
        setSuggestions(e.data.chips.filter((c) => c.estCount > 0));
        break;
      case "products.ready": {
        // 경로 B — 카드는 SSE에 없다. 각 listId 로 CH-5 를 개별 조회해 패널에 넣는다.
        // listIds 는 항상 배열이다(세트형·니즈별 추천이 여러 묶음일 수 있음, 상한 10).
        // 조회 실패(404 등)는 재시도 버튼이 아니라 안내만 — 답변 자체는 정상 종료됐으므로.
        // 서버가 아직 단수 listId 를 보낸다 — 배열 우선, 없으면 길이 1로 승격
        const listIds =
          e.data.listIds ?? (e.data.listId ? [e.data.listId] : []);
        if (!listIds.length) break;

        pendingFetches.push(
          // 병렬 조회하되 결과는 listIds 순서(=I-21 lists 순서)로 한 번에 넣는다.
          // 개별 push 하면 응답이 빨리 온 묶음이 앞서 붙어 순서가 뒤집힌다.
          Promise.all(
            listIds.map((id) =>
              fetchChatListGroup(id).catch(() => null),
            ),
          ).then((groups) => {
            const usable = groups.filter(
              (g): g is NonNullable<typeof g> =>
                // 카드가 0개라도 드롭이 있었다면 넣는다 — "추천이 다 품절됐다"는
                // 사실 자체가 안내거리다(200 · items:[] · itemsDropped>0, CH-5).
                g !== null &&
                Boolean(g.items.length || g.recommendation?.itemsDropped),
            );
            if (usable.length) {
              pushResult({ kind: "products", groups: usable });
            }

            // 404 RESOURCE_NOT_FOUND(listId 만료·미존재)가 대표 사유다.
            // TTL 만료는 재시도해도 계속 404이므로 "다시 시도"를 권하지 않는다.
            //
            // 하나도 못 가져왔으면 패널을 건드리지 않는다 — pushResult 를 부르지
            // 않았으므로 이전 턴의 카드가 그대로 남는다. 명세가 "오류 화면을 띄우지
            // 말고 가지고 있던 카드를 그대로 보여주라"고 한 지점이다(CH-5).
            // 답변 자체는 정상 종료됐으므로 말풍선에도 실패로 표시하지 않는다.
            if (!usable.length) {
              appendToLastAssistant(
                "\n\n추천 카드를 새로 불러오지 못해 이전 결과를 그대로 두었어요.",
              );
            } else if (usable.length < listIds.length) {
              // 일부만 실패 — 가져온 묶음은 이미 패널에 넣었고 빠진 게 있다는 사실만 알린다
              appendToLastAssistant(
                "\n\n일부 추천 묶음을 불러오지 못했어요.",
              );
            }
          }),
        );
        break;
      }
      case "draft":
        pushResult({ kind: "draft", draft: e.data });
        // 등록 초안이 뜨면 입력창을 초안 모드로 — 딴 주제로 넘어가 초안이
        // 방치되지 않게 한다. 수정 턴에서 새 draft 가 오면 같은 코드가 다시
        // 돌아 draftId·타이머가 함께 갱신된다(별도 분기 불필요).
        if (e.data.op === "create") setActiveDraft(e.data.draftId);
        break;
      case "report":
        // 보관만 하고 화면에 꽂지 않는다 — 커밋 신호는 done{replace} 다.
        // 여기서 바로 반영하면 report 뒤에 error 로 끝나는 스트림에서
        // 실패한 턴의 리포트가 패널에 남는다(계약 §3.2: error 종료 시 폐기).
        pendingReport = e.data;
        break;
      case "action": {
        // 장바구니 담기·삭제·수량변경, 찜 추가·해제, 판매자 수정 결과(계약 CH-2 §action).
        // message 는 AI 가 조립한 사용자 노출 안전 문구다 — 그대로 붙이고
        // 문구를 하드코딩하거나 파싱하지 않는다. 분기는 type·reason 으로만.
        const action = e.data;
        appendToLastAssistant(`\n\n${action.message}`);
        // 수정 결과면 해당 draft 카드를 확정 상태로 잠금
        if (
          action.type === "PRODUCT_UPDATED" ||
          action.type === "PRODUCT_UPDATE_FAILED"
        ) {
          const drafts = useChatStore
            .getState()
            .results.filter((r) => r.kind === "draft" && !r.settled);
          // 등록 초안은 productId 가 null 이다(아직 상품이 없으니까) —
          // productId 로만 찾으면 등록 결과가 카드에 영원히 반영되지 않는다.
          // 등록은 확정 대기 중인 create 초안을 대상으로 잡는다.
          const pending =
            drafts.find(
              (r) =>
                r.kind === "draft" &&
                r.draft.productId === action.productId,
            ) ??
            drafts.find(
              (r) => r.kind === "draft" && r.draft.op === "create",
            );
          if (pending?.kind === "draft") {
            settleDraft(pending.draft.draftId, action);
            // 등록이 끝났으면 초안 모드를 푼다(실패면 계속 고칠 수 있게 유지)
            if (
              pending.draft.op === "create" &&
              action.type === "PRODUCT_UPDATED"
            ) {
              setActiveDraft(null);
            }
          }
        }
        // 이 경로에서는 행동 이벤트를 쏘지 않는다.
        //
        // 예전엔 CART_ADDED 하나만 add_to_cart 로 쐈지만, SSE 페이로드가
        // cartItemId·message 뿐이라 명세 필수 키(quantity·price)를 채우지 못해
        // 서버에 _incomplete 로 쌓였다. 그래서 담기 3개 경로를 모두 커버하는
        // BE CartService 단일 지점 적재로 이관됨(A 문서, 2026-08-06).
        //
        // 나머지 액션(삭제·수량변경·찜)도 여기서 쏘지 않는다 — 대응하는
        // eventType 이름이 E-1 FE 화이트리스트에 없다(analytics/types.ts).
        onAction?.(action);
        break;
      }
      case "done": {
        setProgress(null);
        // zero_result: 결과 0건(에러 아님). AI token 안내가 없었으면 기본 문구로 채운다.
        if (e.data.finishReason === "zero_result") {
          const last = useChatStore.getState().messages.slice(-1)[0];
          if (last?.role === "assistant" && !last.text) {
            appendToLastAssistant(
              "조건에 맞는 상품을 찾지 못했어요. 조건을 바꿔 다시 시도해 주세요.",
            );
          }
        }
        // 분석 리포트(analysis+replace)는 우측 패널로 교체된다.
        // 구조화 report 우선, 없으면 token 연문 승계(계약 §0 fallback).
        const st = useChatStore.getState();
        if (st.lane === "analysis" && e.data.panel === "replace") {
          const last = st.messages[st.messages.length - 1];
          const next = resolveAnalysisReport(
            pendingReport,
            last?.role === "assistant" ? last.text : undefined,
          );
          // null 이면 패널을 건드리지 않는다 — 이전 리포트가 남는 게 낫다
          if (next) setAnalysisReport(next);
        }
        onDone?.(e.data.panel);
        break;
      }
      case "error":
        // 종결 이벤트 — 해당 말풍선에 에러 표시.
        //
        // 재시도 여부는 code 가 아니라 retryable 로 판단한다 — 같은 LLM_UNAVAILABLE
        // 이라도 "미구성"(재시도 무의미)과 "일시 불가"(유효)가 섞여 있어
        // emit 지점만이 안다. requestId 는 사용자 신고 시 서버 로그 추적에 쓴다.
        // 계약상 message 가 사용자 문구지만, 운영에서는 raw 원문이 섞일 수 있어
        // code 기반 기본 카피로 한 번 더 정규화한다.
        setProgress(null); // 종결 이벤트 — 진행 표시를 남기지 않는다
        // 계약 §3.2: error 종료 시 보관 중인 리포트는 폐기한다.
        // 패널은 건드리지 않는다 — done 이 안 왔으니 이전 리포트가 정본이다.
        pendingReport = null;
        failLastAssistant(
          resolveChatErrorMessage(e.data.code, e.data.message),
          {
          retryable: e.data.retryable,
          requestId: e.data.requestId,
          },
        );
        break;
    }
  };

  /**
   * 스트림이 끝나도 products.ready 의 CH-5 조회가 남아 있을 수 있다 — 함께 기다린다.
   * (각 조회는 내부에서 catch 하므로 여기서 예외로 실패 처리되지 않는다.)
   */
  const settle = async () => {
    if (pendingFetches.length) await Promise.all(pendingFetches);
  };

  return { onEvent, settle };
}
