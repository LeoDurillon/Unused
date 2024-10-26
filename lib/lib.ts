const correctExt = ["js", "ts", "jsx", "tsx"];

export default class ImporterCheck {
  public checked: Set<string>;
  constructor(
    public list: { name: string; path: string }[],
    public shortcut: { short: string; long: string }[],
    public folder: string
  ) {
    this.checked = new Set();
  }

  checkFile(entry: string) {
    if (this.checked.has(entry)) {
      return true;
    }
    this.checked.add(entry);
  }

  public async checkIsUsed(entry: string): Promise<Set<string>> {
    if (this.checkFile(entry)) return new Set();

    const imports = await this.getImportsLine(entry);
    let checkedPath: Set<string> = new Set();
    for (const imp of imports) {
      if (imp.startsWith("~/edgedb")) continue;
      if (!imp) {
        continue;
      }
      const modifiedImp = this.parsePath(imp, entry);
      const goBackLength = this.countGoBack(modifiedImp);
      const path = modifiedImp.match(/[(\.\.\/)]+(\/.+)/);
      if (!path) {
        continue;
      }
      const file = this.list.find((file) =>
        file.path.split(".").slice(0, -1).join(".").endsWith(path[1])
      );
      if (!file) {
        continue;
      }
      checkedPath.add(file.path);
      const nextPath = `${this.goBack(entry, goBackLength)}${this.goBack(
        path[1],
        1
      )}/${file.name}`;

      checkedPath = checkedPath.union(await this.checkIsUsed(nextPath));
    }
    return checkedPath;
  }

  countGoBack(filePath: string) {
    const count = filePath.match(/(\.\.\/)/g);
    if (!count) return 1;
    return count.length + 1;
  }

  goBack(path: string, goBack: number) {
    return path
      .split("/")
      .slice(0, 0 - goBack)
      .join("/");
  }

  findMatchingShortcut(path: string, currentPath: string) {
    const filteredShortCut = this.shortcut.filter((e) =>
      path.startsWith(e.short)
    );
    const shortcut = filteredShortCut.sort((a, b) =>
      a.short.length > b.short.length ? -1 : 1
    )[0];

    return path
      .replace(shortcut.short, this.folder + shortcut.long.split(".")[1])
      .split("/");
  }

  parsePath(path: string, currentPath: string) {
    if (!path.startsWith("~")) return path;
    const fullPathSplitted = this.findMatchingShortcut(path, currentPath);
    const splittedCurrent = currentPath.split("/");
    const finalPath: string[] = [];
    for (let i = 0; i < fullPathSplitted.length; i++) {
      if (splittedCurrent[i] === fullPathSplitted[i] && finalPath.length === 0)
        continue;
      if (!finalPath.length) {
        finalPath.push(...new Array(splittedCurrent.length - i - 1).fill(".."));
      }
      finalPath.push(fullPathSplitted[i]);
    }

    return finalPath.join("/");
  }

  async getImportsLine(file: string) {
    const importLines = (await Bun.file(file).text())
      .split("\n")
      .filter((line) => line.startsWith("import"));
    const regExp = new RegExp(/['"]([~.//].+)['"]/);
    const imports = importLines
      .map((line) => {
        const el = regExp.exec(line);

        if (!el) return;
        return el[1];
      })
      .filter((e) => !!e);

    return imports as string[];
  }
}

export async function getFileList(basePath: string, originalPath: string) {
  const fileList: { name: string; path: string }[] = [];

  const files = await (
    await Bun.$`ls -l ${basePath}`.quiet()
  )
    .text()
    .split("\n")
    .filter((e) => !!e);

  fileList.push(
    ...files
      .filter(
        (file) =>
          !file.endsWith(".d.ts") &&
          correctExt.some((ext) => file.endsWith(ext))
      )
      .map((file) => ({
        name: file,
        path: `${basePath}/${file}`.split(originalPath)[1],
      }))
  );
  const folders = files.filter(
    (file) => file.split(".").length < 2 && !file.includes("node_modules")
  );
  for (const folder of folders) {
    fileList.push(
      ...(await getFileList(`${basePath}/${folder}`, originalPath))
    );
  }

  return fileList;
}

export async function parseShortcuts(folder: string) {
  const itemsRegex = /(.+"(.+)": \["(.+)"\],?)/;
  const pathRegex = /"paths": {\n(.+\n)+.+}\n/gm;
  const file = Bun.file(folder + "/tsconfig.json");
  if (!(await file.exists())) {
    console.log("No tsconfig.json found");
    return [];
  }
  const text = (await file.text()).match(pathRegex);
  if (!text) return [];
  const items = text[0].split("\n").map((e) => e.match(itemsRegex));

  return items
    .filter((e) => !!e)
    .map((e) => ({ short: e?.[2].split("*")[0], long: e?.[3].split("*")[0] }));
}
