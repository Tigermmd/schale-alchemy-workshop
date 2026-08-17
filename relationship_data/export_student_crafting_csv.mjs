import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Workbook } from "@oai/artifact-tool";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.BA_RELATIONSHIP_DATA_DIR
  ? path.resolve(process.env.BA_RELATIONSHIP_DATA_DIR)
  : here;
const outputPath = path.join(dataDir, "student_crafting_expectations.csv");
const previewPath = "/tmp/student_crafting_expectations_preview.png";
const giftPreviewPath = "/tmp/student_crafting_expectations_gifts_preview.png";

const readJson = async (filename) =>
  JSON.parse(await fs.readFile(path.join(dataDir, filename), "utf8"));

const giftsData = await readJson("gifts.json");
const preferencesData = await readJson("student_gift_preferences.json");
const craftingData = await readJson("crafting_expected_relationship.json");

const giftsById = new Map(giftsData.gifts.map((gift) => [gift.id, gift]));
const craftingById = new Map(
  craftingData.students.map((student) => [student.student_id, student]),
);

const formatGiftName = (giftValue) => {
  const gift = giftsById.get(giftValue.gift_id);
  if (!gift) throw new Error(`Gift ${giftValue.gift_id} is missing from gifts.json`);
  return gift.name_zh_cn;
};

const formatGiftsByExp = (student, relationshipExp) =>
  student.gift_values
    .filter((gift) => gift.relationship_exp === relationshipExp)
    .map(formatGiftName)
    .join("、");

const formatOtherGiftByExp = (student, relationshipExp, label) =>
  student.gift_values.some((gift) => gift.relationship_exp === relationshipExp)
    ? label
    : "";

const headers = [
  "学生名称",
  "第一阶段期望好感值",
  "第二阶段期望好感值",
  "第三阶段期望好感值",
  "完整三阶段期望好感值",
  "每枚制造石期望好感值",
  "240好感值礼物",
  "180好感值礼物",
  "120好感值礼物",
  "80好感值礼物",
  "60好感值礼物",
  "40好感值礼物",
  "20好感值礼物",
];

const rows = preferencesData.students.map((student) => {
  const crafting = craftingById.get(student.student_id);
  if (!crafting) throw new Error(`Crafting result missing for student ${student.student_id}`);
  return [
    student.name_zh_cn,
    crafting.stage_expected_relationship_exp["1"],
    crafting.stage_expected_relationship_exp["2"],
    crafting.stage_expected_relationship_exp["3"],
    crafting.full_three_stage_expected_relationship_exp,
    crafting.relationship_exp_per_manufacturing_stone,
    formatGiftsByExp(student, 240),
    formatGiftsByExp(student, 180),
    formatOtherGiftByExp(student, 120, "其他紫礼物"),
    formatGiftsByExp(student, 80),
    formatGiftsByExp(student, 60),
    formatGiftsByExp(student, 40),
    formatOtherGiftByExp(student, 20, "其他金礼物"),
  ];
});

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("学生制造期望");
const matrix = [headers, ...rows];
const range = sheet.getRangeByIndexes(0, 0, matrix.length, headers.length);
range.values = matrix;
sheet.freezePanes.freezeRows(1);
sheet.showGridLines = false;
sheet.getRangeByIndexes(0, 0, 1, headers.length).format = {
  fill: "#D9EAF7",
  font: { bold: true, color: "#17365D" },
  wrapText: true,
  rowHeight: 50,
};
sheet.getRangeByIndexes(0, 0, matrix.length, headers.length).format.wrapText = false;
sheet.getRangeByIndexes(0, 0, 1, headers.length).format.wrapText = true;
sheet.getRangeByIndexes(0, 0, matrix.length, headers.length).format.columnWidth = 20;
sheet.getRangeByIndexes(0, 0, matrix.length, 1).format.columnWidth = 14;
sheet.getRangeByIndexes(0, 1, matrix.length, 5).format.columnWidth = 15;
sheet.getRangeByIndexes(0, 6, matrix.length, 7).format.columnWidth = 28;
sheet.getRangeByIndexes(1, 1, rows.length, 5).format.numberFormat = "0.000000";

const escapeCsv = (value) => {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const csvText = sheet
  .getUsedRange()
  .values.map((row) => row.map(escapeCsv).join(","))
  .join("\r\n") + "\r\n";
await fs.writeFile(outputPath, csvText, "utf8");

const preview = await workbook.render({
  sheetName: "学生制造期望",
  range: "A1:M7",
  scale: 1,
  format: "png",
});
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));
const giftPreview = await workbook.render({
  sheetName: "学生制造期望",
  range: "G1:M7",
  scale: 1,
  format: "png",
});
await fs.writeFile(giftPreviewPath, new Uint8Array(await giftPreview.arrayBuffer()));

const imported = await Workbook.fromCSV(csvText, { sheetName: "Imported" });
const importedValues = imported.worksheets.getItem("Imported").getUsedRange().values;
if (importedValues.length !== 258 || importedValues[0].length !== headers.length) {
  throw new Error(`CSV round-trip shape mismatch: ${importedValues.length}x${importedValues[0]?.length}`);
}

console.log(JSON.stringify({
  outputPath,
  rowCount: rows.length,
  columnCount: headers.length,
  importedRowCount: importedValues.length - 1,
  importedColumnCount: importedValues[0].length,
  previewPath,
  giftPreviewPath,
  sample: rows[0].slice(0, 8),
}, null, 2));
