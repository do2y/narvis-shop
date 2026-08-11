import type { ConditionChip, ConditionField } from "@/shared/types/chat";

/**
 * 칩 하나를 낙관적으로 걷어낸 결과를 만든다(계약 CH-2 §conditions, v0.32.14).
 *
 * **(field, value) 쌍으로 지운다.** category·brand 는 값당 칩 1개로 나뉘어 같은
 * field 가 여러 개 오므로, field 만 보면 카테고리 칩 하나를 눌렀는데 카테고리가
 * 전부 사라진다.
 *
 * 값이 하나뿐인 축(priceMax·priceMin·ratingMin·keyword)은 서버가 value 를 무시하고
 * 축 전체를 지우는데, 그 축은 애초에 칩도 하나라 여기 결과와 서버 결과가 같다.
 *
 * 서버 응답의 다음 conditions 이벤트가 전체를 덮어쓰므로, 이 값이 서버 상태와
 * 어긋난 채로 남지는 않는다.
 */
export function removeChip(
  conditions: ConditionChip[],
  field: ConditionField,
  value: string | number,
): ConditionChip[] {
  return conditions.filter((c) => !(c.field === field && c.value === value));
}
