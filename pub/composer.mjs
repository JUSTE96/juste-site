// Pose le calque JusteCV sur un plan filmé. Usage : node composer.mjs <metier> <plan.mp4> <sortie.mp4>
// CADRE=0..1 : où recadrer un plan horizontal (0 = bord gauche, 0.5 = centre). RALENTI=1.5 : étire un plan de 8 s sur 12 s.
import { spawn } from "node:child_process";
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const { chromium } = await import(process.env.PLAYWRIGHT || "playwright");
const ici = path.dirname(fileURLToPath(import.meta.url));
const [m, plan, sortie] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await p.goto("file://" + ici + "/calque.html?m=" + m); await p.evaluate(() => window.pret);
const duree = await p.evaluate(() => window.DUREE);
const tmp = sortie.replace(/\.mp4$/, ".tmp.mp4");
const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-i", plan, "-f", "image2pipe", "-framerate", "30", "-c:v", "png", "-i", "-",
  "-filter_complex", `[0:v]setpts=${process.env.RALENTI || 1}*PTS,fps=30,scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920:(iw-1080)*${process.env.CADRE || 0.5}:0,setsar=1[f];[f][1:v]overlay=0:0:shortest=1,format=yuv420p[v]`,
  "-map", "[v]", "-an", "-t", String(duree), "-c:v", "libx264", "-crf", "19", "-preset", "veryfast", "-movflags", "+faststart", tmp], { stdio: ["pipe", "inherit", "inherit"] });
ff.stdin.on("error", () => {});
for (let i = 0; i < duree * 30; i++) {
  await p.evaluate((ms) => window.seek(ms), i * 1000 / 30);
  const img = await p.screenshot({ type: "png", omitBackground: true });
  if (!ff.stdin.write(img)) await new Promise((r) => ff.stdin.once("drain", r));
}
ff.stdin.end();
const code = await new Promise((r) => ff.on("close", r));
await b.close();
if (code === 0) { fs.renameSync(tmp, sortie); console.log("écrit", sortie); } else { console.error("ffmpeg a échoué", code); process.exit(1); }
