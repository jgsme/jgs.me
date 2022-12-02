import { writeFile } from "fs/promises";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const main = async () => {
  const [res1, res2] = await Promise.all([
    fetch("https://w.kbys.tk/api/recent_articles"),
    fetch("https://w.kbys.tk/api/recent_clips"),
  ]);
  const [articles, clips] = await Promise.all([res1.json(), res2.json()]);
  await writeFile(
    resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../src/data/updates.json"
    ),
    JSON.stringify({ articles, clips })
  );
};

main();
