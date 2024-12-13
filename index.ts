import Parser from "@leodurillon/bun-parser";
import ImporterCheck, { getFileList, parseShortcuts } from "./lib/lib";

async function check(
  folder: string,
  checker: ImporterCheck,
  routerFiles: { name: string; path: string }[]
) {
  let checkFiles: Set<string> = new Set();

  for (const file of routerFiles) {
    const newlychecked = await checker.checkIsUsed(
      `${parentFolder}${file.path}`.replaceAll("//", "/")
    );
    checkFiles = checkFiles.union(newlychecked);
  }

  return checkFiles;
}

const excludedFiles = new Set([
  "entry.express.tsx",
  "entry.ssr.tsx",
  "entry.dev.tsx",
  "entry.preview.tsx",
  "service-worker.ts",
  "router-head.tsx",
  "tailwind.config.ts",
  "tailwind.config.js",
  "vite.config.ts",
  "vite.config.js",
  "postcss.config.js",
]);

const args = Parser.generate({
  name: "unused",
  help: {
    name: "--help",
    short: "-h",
  },
  path: true,
});

if (typeof args === "string") {
  process.exit(0);
}

console.clear();
console.log("Get all file from path...");

const parentFolder = args.path.selected;
console.log("Search for tsconfig.json...");
const shortCuts = await parseShortcuts(parentFolder);
let fileList = await getFileList(parentFolder, parentFolder);
console.log(`Found ${fileList.length} files`);
console.log("Search for unused files...");
const routerFiles = fileList.filter(
  (e) =>
    e.path.endsWith("root.tsx") ||
    e.path.endsWith("index.tsx") ||
    e.path.endsWith("layout.tsx") ||
    e.path.endsWith("index.ts") ||
    e.path.endsWith("layout.ts") ||
    (e.path.includes("index@") && e.path.endsWith(".tsx")) ||
    (e.path.includes("layout-") && e.path.endsWith(".tsx")) ||
    (e.path.includes("plugin-") && e.path.endsWith(".tsx"))
);
fileList = fileList.filter(
  (e) =>
    !excludedFiles.has(e.name) &&
    e.name.split(".").length > 1 &&
    !(e.path.startsWith("/dist") || e.path.startsWith("/server"))
);
const checker = new ImporterCheck(fileList, shortCuts, parentFolder);
const checkFiles = await check(parentFolder, checker, routerFiles);

const unusedFile = fileList.filter(
  (e) =>
    !(
      e.path.endsWith("root.tsx") ||
      e.path.endsWith("index.tsx") ||
      e.path.endsWith("layout.tsx") ||
      e.path.endsWith("index.ts") ||
      e.path.endsWith("layout.ts") ||
      (e.path.includes("index@") && e.path.endsWith(".tsx")) ||
      (e.path.includes("layout-") && e.path.endsWith(".tsx")) ||
      (e.path.includes("plugin-") && e.path.endsWith(".tsx"))
    ) && !checkFiles.has(e.path)
);

if (!unusedFile.length) {
  console.log(`Did not found any unused file`);
  process.exit(0);
}

console.log(`Found ${unusedFile.length} unused files`);
console.log("List of files ( name | path )");
unusedFile
  .sort((a, b) => a.path.localeCompare(b.path))
  .forEach((file) => {
    console.log(`\t${file.name} | ${file.path}`);
  });
let goodInput = false;
const validInput = {
  accept: ["y", "yes", "Y", "Yes", "o", "oui"],
  refuse: ["n", "no", "N", "No", "non", "Non"],
};
let value: string | null;
while (!goodInput) {
  console.log(
    "The program want to move the selected files to an external folder"
  );
  value = prompt("Do you want to continue(y/N)", "y");
  if (!value) continue;

  if (validInput.accept.includes(value) || validInput.refuse.includes(value)) {
    goodInput = true;
  }
}

if (validInput.accept.includes(value!)) {
  console.log("Creating folder for unusedFile...");
  await Bun.$`mkdir ${parentFolder}/unusedFile`;
  console.log("Move unused file to created folder...");
  for (const file of unusedFile) {
    await Bun.$`mv ${parentFolder}${file.path} ${parentFolder}/unusedFile`;
  }
  console.log(
    `The files have been successfully moved to ${parentFolder}/unusedFile`
  );
}
process.exit(0);
