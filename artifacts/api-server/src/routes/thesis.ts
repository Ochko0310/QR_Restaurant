import { Router } from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const THESIS_DIR = path.resolve(__dirname, "../../diploma_latex");

const router = Router();

const ALL_FILES = [
  { label: "main.tex", path: "main.tex", desc: "Үндсэн файл" },
  { label: "MUST-Thesis.cls", path: "MUST-Thesis.cls", desc: "ШУТИС LaTeX загвар" },
  { label: "references.bib", path: "references.bib", desc: "Ном зүй (25+ эх сурвалж)" },
  { label: "MUST_logo.png", path: "Figures/MUST_logo.png", desc: "ШУТИС лого" },
  { label: "Titlepage.tex", path: "FrontBackMatter/Titlepage.tex", desc: "Нүүр хуудас" },
  { label: "Plan-Review.tex", path: "FrontBackMatter/Plan-Review.tex", desc: "Төлөвлөгөө / Гүйцэтгэл" },
  { label: "Declaration.tex", path: "FrontBackMatter/Declaration.tex", desc: "Зохиогчийн эрх" },
  { label: "Abstract.tex", path: "FrontBackMatter/Abstract.tex", desc: "Хураангуй (МН + EN)" },
  { label: "Acknowledgments.tex", path: "FrontBackMatter/Acknowledgments.tex", desc: "Талархал" },
  { label: "Abbreviations.tex", path: "FrontBackMatter/Abbreviations.tex", desc: "Товчилсон үгс" },
  { label: "Chapter1.tex", path: "Chapters/Chapter1.tex", desc: "1-р бүлэг: Судалгааны хэсэг" },
  { label: "Chapter2.tex", path: "Chapters/Chapter2.tex", desc: "2-р бүлэг: Системийн шаардлага" },
  { label: "Chapter3.tex", path: "Chapters/Chapter3.tex", desc: "3-р бүлэг: Төслийн хэсэг" },
  { label: "Chapter4.tex", path: "Chapters/Chapter4.tex", desc: "4-р бүлэг: Хэрэгжилт ба туршилт" },
  { label: "Conclusion.tex", path: "Chapters/Conclusion.tex", desc: "Дүгнэлт" },
  { label: "AppendixA.tex", path: "Appendices/AppendixA.tex", desc: "Хавсралт А: SQL схем + API" },
];

router.get("/thesis", (_req, res) => {
  const rows = ALL_FILES.map(f => `
    <tr>
      <td><code>${f.label}</code></td>
      <td>${f.desc}</td>
      <td><a href="/api/thesis/download?file=${encodeURIComponent(f.path)}" download="${f.label}">⬇ Татах</a></td>
    </tr>`).join("");

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="mn">
<head>
  <meta charset="UTF-8">
  <title>ШУТИС Дипломын Ажил — LaTeX Файлууд</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 820px; margin: 40px auto; padding: 0 20px; background: #f5f5f5; }
    h1 { color: #1a3a6b; border-bottom: 3px solid #1a3a6b; padding-bottom: 10px; }
    p.sub { color: #555; margin-top: -8px; }
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    th { background: #1a3a6b; color: white; padding: 12px 16px; text-align: left; }
    td { padding: 10px 16px; border-bottom: 1px solid #eee; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #f0f7ff; }
    a { color: #1a3a6b; font-weight: bold; text-decoration: none; padding: 4px 10px; background: #e8f0fe; border-radius: 4px; }
    a:hover { background: #1a3a6b; color: white; }
    code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-size: 13px; }
    .info { background: #e8f4fd; border-left: 4px solid #1a3a6b; padding: 12px 16px; margin: 20px 0; border-radius: 4px; }
    .overleaf { display: inline-block; margin: 16px 0; padding: 10px 20px; background: #4CAF50; color: white; border-radius: 6px; font-size: 15px; text-decoration: none; font-weight: bold; }
    .overleaf:hover { background: #388e3c; }
  </style>
</head>
<body>
  <h1>🎓 ШУТИС Дипломын Ажил — LaTeX Файлууд</h1>
  <p class="sub">QR Кодоор Суурилсан Рестораны Ширээний Мобайл Захиалгын Систем</p>

  <div class="info">
    <strong>Overleaf дээр хэрхэн ажиллуулах:</strong><br>
    1. Доорх бүх файлуудыг татаж авна<br>
    2. <a href="https://overleaf.com" target="_blank">overleaf.com</a> дээр бүртгүүлнэ (үнэгүй)<br>
    3. "New Project" → "Upload Project" → файлуудаа оруулна<br>
    4. <strong>main.tex</strong> сонгоод "Compile" дарна → PDF гарна
  </div>

  <a class="overleaf" href="https://overleaf.com/register" target="_blank">Overleaf бүртгүүлэх →</a>

  <table>
    <thead>
      <tr><th>Файлын нэр</th><th>Агуулга</th><th>Татах</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <br>
  <p style="color:#888; font-size:13px">Файл бүрийг тус тусад нь татаж авна уу. Дараа нь Overleaf-д оруулна.</p>
</body>
</html>`);
});

router.get("/thesis/download", (req, res) => {
  const filePath = req.query["file"] as string;
  if (!filePath) {
    res.status(400).send("file parameter required");
    return;
  }

  const fullPath = path.resolve(THESIS_DIR, filePath);
  if (!fullPath.startsWith(THESIS_DIR)) {
    res.status(403).send("Forbidden");
    return;
  }

  if (!fs.existsSync(fullPath)) {
    res.status(404).send("File not found");
    return;
  }

  const filename = path.basename(fullPath);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Type", "application/octet-stream");
  res.sendFile(fullPath);
});

export default router;
