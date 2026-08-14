function packageIsUsable(item, asOf = "2026-08-12") {
  if (!item || ["expired", "template"].includes(item.status)) return false;
  if (item.available_from && String(asOf) < String(item.available_from)) return false;
  if (item.available_to && String(asOf) > String(item.available_to)) return false;
  return true;
}

export function getCnGiftPackageCatalog(snapshot) {
  return {
    server: "cn",
    asOf: snapshot?.scope?.as_of ?? null,
    sources: Array.isArray(snapshot?.sources) ? [...snapshot.sources] : [],
    packages: Array.isArray(snapshot?.packages) ? snapshot.packages.map((item) => ({
      ...item,
      packageId: item.packageId ?? item.id,
      server: "cn",
      availability: item.availability ?? (item.availability_phase === "student_launch" || item.availability_phase === "mika_launch" ? "student_launch" : "current"),
      targetStudentIds: item.targetStudentIds ?? item.gift_binding?.target_student_ids ?? [],
      source: item.source ?? null,
      asOf: item.asOf ?? snapshot?.scope?.as_of ?? null,
    })) : [],
  };
}

export function getEligibleGiftPackages({ catalog, studentId, asOf = "2026-08-12", includeStudentLaunchPackages = true } = {}) {
  const id = Number(studentId);
  return (catalog?.packages ?? []).filter((item) => {
    if (!packageIsUsable(item, asOf)) return false;
    if (!includeStudentLaunchPackages && item.availability === "student_launch") return false;
    const binding = item.gift_binding;
    if (binding?.type !== "student_specific_favorites") return true;
    const ids = Array.isArray(item.targetStudentIds) && item.targetStudentIds.length
      ? item.targetStudentIds.map(Number)
      : Array.isArray(binding.target_student_ids)
      ? binding.target_student_ids.map(Number)
      : binding.target_student_id === undefined || binding.target_student_id === null ? [] : [Number(binding.target_student_id)];
    return ids.includes(id);
  });
}
