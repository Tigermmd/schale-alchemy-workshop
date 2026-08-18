export function filterStudents(students, query, localization) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return students;
  return students.filter((student) =>
    [
      student.name_zh_cn,
      student.name_en,
      localization?.students?.[String(student.student_id)],
      String(student.student_id),
    ]
      .filter(Boolean)
      .some((value) => value.toLocaleLowerCase().includes(normalized)),
  );
}

export function readSelectedStudentId(search, students) {
  const requested = new URLSearchParams(search).get("student");
  const exists = students.some((student) => String(student.student_id) === requested);
  return exists ? requested : String(students[0]?.student_id ?? "");
}

export function readPackageTargetStudentId(search, students, fallbackId = null) {
  const params = new URLSearchParams(search);
  const requested = params.get("packageStudent")
    ?? (params.get("view") === "packages" ? params.get("student") : null);
  const available = new Set((students ?? []).map((student) => String(student.student_id)));
  if (requested && available.has(requested)) return requested;
  const fallback = fallbackId === null || fallbackId === undefined ? null : String(fallbackId);
  return fallback && available.has(fallback) ? fallback : null;
}

export function writeSelectedStudentId(studentId) {
  const url = new URL(window.location.href);
  url.searchParams.set("student", studentId);
  window.history.replaceState({}, "", url);
}

export function giftValuesForFilter(student, filter) {
  if (filter === "preferred") return student.preferred_gifts ?? [];
  if (filter === "all") return student.gift_values ?? [];
  if (!String(filter).startsWith("exp-")) return student.gift_values ?? [];
  const targetExp = Number(String(filter).slice(4));
  return (student.gift_values ?? []).filter((gift) => gift.relationship_exp === targetExp);
}

export function boostedGiftValues(student) {
  return [...(student?.gift_values ?? [])]
    .filter((gift) => ![20, 120].includes(Number(gift.relationship_exp)))
    .sort((a, b) =>
      Number(b.relationship_exp) - Number(a.relationship_exp) ||
      Number(b.reaction_grade) - Number(a.reaction_grade) ||
      Number(a.gift_id) - Number(b.gift_id),
    );
}

export function boostedGiftGroups(student) {
  const values = boostedGiftValues(student);
  return [4, 3, 2]
    .map((reactionGrade) => ({
      reaction_grade: reactionGrade,
      gifts: values.filter((gift) => Number(gift.reaction_grade) === reactionGrade),
    }))
    .filter((group) => group.gifts.length > 0);
}

export function getCraftingMechanismSummary(snapshot, studentCrafting) {
  const probability = snapshot?.crafting_probability ?? {};
  const stages = ["1", "2", "3"].map((stage) => ({
    id: stage,
    nodeCount:
      studentCrafting?.stage_node_count?.[stage] ??
      probability.stage_totals?.[stage]?.node_count ??
      0,
    expectedExp: studentCrafting?.stage_expected_relationship_exp?.[stage] ?? 0,
    expectedGiftQuantity: studentCrafting?.stage_expected_gift_quantity?.[stage] ?? 0,
    noPositiveProbability:
      studentCrafting?.stage_no_positive_relationship_probability?.[stage] ?? 0,
    nodeDistribution: probability.node_distributions?.[stage] ?? [],
    giftCapableNodes: probability.gift_capable_node_names_by_stage?.[stage] ?? [],
    nodeExpectations: studentCrafting?.stage_node_expectations?.[stage] ?? [],
  }));
  return {
    optionCount: snapshot?.scope?.node_option_count ?? 5,
    stages,
  };
}
