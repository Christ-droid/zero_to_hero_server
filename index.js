import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import multer from "multer";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(express.json({ limit: "10mb" }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));
app.use(cors());

// --- Dossier uploads ---
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// --- Multer (upload) ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// --- API d’upload ---
app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Aucun fichier reçu" });
  const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});

// --- Fichiers uploadés ---
app.use("/uploads", express.static(uploadDir));

// --- siteContent.json ---
const contentPath = path.join(process.cwd(), "siteContent.json");
let siteContent = {};
try {
  if (fs.existsSync(contentPath)) {
    const raw = fs.readFileSync(contentPath, "utf-8");
    siteContent = JSON.parse(raw);
    console.log("✅ siteContent.json chargé");
  } else {
    siteContent = { home: {}, activities: {} };
    fs.writeFileSync(contentPath, JSON.stringify(siteContent, null, 2));
    console.warn("⚠️ Nouveau siteContent.json créé");
  }
} catch (err) {
  console.error("❌ Erreur lecture siteContent :", err);
}

// --- ✅ ROUTES API ---
app.get("/api/content", (req, res) => {
  res.json(siteContent);
});

app.post("/api/content", (req, res) => {
  try {
    siteContent = { ...siteContent, ...req.body };
    fs.writeFileSync(contentPath, JSON.stringify(siteContent, null, 2));
    res.json({ success: true });
  } catch (err) {
    console.error("Erreur POST /api/content :", err);
    res.status(500).json({ error: "Erreur de sauvegarde" });
  }
});

// --- ✅ SERVE LE FRONTEND (APRÈS LES ROUTES API) ---
const frontendDir = path.join(process.cwd(), "dist");
if (fs.existsSync(frontendDir)) {
  app.use(express.static(frontendDir));
  app.get("*", (_, res) => res.sendFile(path.join(frontendDir, "index.html")));
  console.log("✅ Frontend servi depuis /dist");
} else {
  console.warn("⚠️ Aucun dossier dist trouvé — fais npm run build !");
}

// --- Lancer le serveur ---
app.listen(PORT, () => {
  console.log(`🚀 Serveur en ligne sur http://localhost:${PORT}`);
});
