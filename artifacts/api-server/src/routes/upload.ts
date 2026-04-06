import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { requireAuth } from "../lib/auth";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, unique);
  },
});

const ALLOWED_MIME_PREFIX = /^image\//;
const ALLOWED_IMAGE_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg",
  ".avif", ".bmp", ".tiff", ".tif", ".heic", ".heif",
  ".ico", ".jfif", ".pjpeg", ".pjp",
]);
const ALLOWED_MODEL_EXTENSIONS = new Set([".glb", ".gltf"]);

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_MIME_PREFIX.test(file.mimetype) || ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Зөвхөн зургийн файл оруулна уу"));
    }
  },
});

const modelUpload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_MODEL_EXTENSIONS.has(ext) || file.mimetype === "model/gltf-binary" || file.mimetype === "model/gltf+json" || file.mimetype === "application/octet-stream") {
      cb(null, true);
    } else {
      cb(new Error("Зөвхөн .glb эсвэл .gltf файл оруулна уу"));
    }
  },
});

const router = Router();

router.post("/upload/image", requireAuth, upload.single("image"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "no_file", message: "Файл олдсонгүй" });
    return;
  }
  const url = `/api/uploads/${req.file.filename}`;
  res.json({ url });
});

router.post("/upload/model", requireAuth, modelUpload.single("model"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "no_file", message: "Файл олдсонгүй" });
    return;
  }
  const url = `/api/uploads/${req.file.filename}`;
  res.json({ url });
});

export default router;
