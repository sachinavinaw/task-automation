import { readFtoExcel, saveJsonToFile } from "../../utils/excelUtils.js";
import fs from "fs";
import { ACTIVE_FTO_REPORT, DATA_OUTPUT_DIR } from "../../config/config.js";

const targetBlockName = ACTIVE_FTO_REPORT.BLOCK_NAME;
const targetFinancialYear = ACTIVE_FTO_REPORT.FINACIAL_YEAR;

const records = readFtoExcel(
  `${DATA_OUTPUT_DIR}/${targetBlockName}/${targetFinancialYear}/excel/MaterialList_FTO_Report.xlsx`,
);

const outputDir = `${DATA_OUTPUT_DIR}/${targetBlockName}/${targetFinancialYear}/json`;

fs.mkdirSync(outputDir, {
  recursive: true,
});

saveJsonToFile(records, `${outputDir}/MaterialList_FTO_Report.json`);
