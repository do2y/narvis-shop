"use client";

const PORTAL_ATTR = "data-print-portal";

/**
 * 특정 요소만 인쇄한다(사용자는 인쇄 대화상자에서 "PDF로 저장"을 고른다).
 *
 * 왜 복제해서 body 밑으로 옮기는가: 인쇄 대상이 flex·overflow 컨테이너
 * 안쪽 깊숙이 있으면, 조상들이 높이를 가둬 내용이 첫 페이지에서 잘린다.
 * "대상만 남기고 조상 스타일을 되돌리는" 방식은 조상 사슬을 전부 풀어야 하고
 * 하나만 놓쳐도 잘리므로, 아예 body 직계로 꺼내는 편이 예측 가능하다.
 *
 * PDF 라이브러리를 쓰지 않는 이유: 한글 폰트를 통째로 임베딩(수 MB)해야 하고
 * 레이아웃을 좌표로 다시 짜야 한다. 인쇄는 화면과 같은 폰트로 나오고
 * 차트(SVG)도 그대로 실린다.
 */
export function printElement(el: HTMLElement | null): void {
  if (typeof window === "undefined" || !el) return;

  // 이전 인쇄에서 남은 것이 있으면 먼저 걷어낸다(중복 출력 방지)
  document.querySelectorAll(`[${PORTAL_ATTR}]`).forEach((n) => n.remove());

  const portal = document.createElement("div");
  portal.setAttribute(PORTAL_ATTR, "");
  // cloneNode(true): 라이브 노드를 옮기면 화면에서 사라졌다가 돌아와
  // 리액트의 DOM 소유권과 충돌한다. 복제본은 리액트가 모르는 노드라 안전하다.
  portal.appendChild(el.cloneNode(true));
  document.body.appendChild(portal);

  const cleanup = () => {
    portal.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  // afterprint 는 인쇄·취소 양쪽에서 오지만, 일부 브라우저가 누락하므로
  // print() 반환 뒤에도 한 번 더 정리한다(중복 호출은 무해하다).
  window.addEventListener("afterprint", cleanup);

  window.print();
  cleanup();
}
