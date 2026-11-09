import "dotenv/config";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { fal } from "@fal-ai/client";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use("/api/", rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false }));
app.use(express.static(path.join(__dirname, "../public")));

const configured = () => ({
  openai: Boolean(process.env.OPENAI_API_KEY),
  elevenlabs: Boolean(process.env.ELEVENLABS_API_KEY),
  fal: Boolean(process.env.FAL_KEY),
  pexels: Boolean(process.env.PEXELS_API_KEY)
});

app.get("/api/status", (_req, res) => res.json(configured()));

app.post("/api/gpt/script", async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: "OPENAI_API_KEY غير مهيأ على الخادم." });
    const { niche, goal, duration, idea, cta } = req.body || {};
    if (!String(idea || "").trim()) return res.status(400).json({ error: "اكتب فكرة الفيديو أولاً." });
    const prompt = `أنت كاتب سكربتات فيديوهات قصيرة عربية محترف لمنشآت محلية. أنشئ سكربتاً واقعياً غير مضلل لنشاط: ${niche || "نشاط محلي"}. الهدف: ${goal || "بناء الثقة"}. المدة: ${Math.min(60, Math.max(10, Number(duration) || 30))} ثانية. الفكرة: ${idea}. CTA المقترح: ${cta || "احفظ الفيديو وشاركه"}.
قواعد: Hook قوي من أول ثانيتين، مشكلة واحدة، حل عملي، جمل قصيرة، لا تختلق أرقاماً أو نتائج أو وعوداً، لا تدّعِ أن الانتشار مضمون. أنشئ 4 إلى 7 مشاهد متنوعة. أعد JSON فقط بهذا الهيكل: {"hook":"...","script":"...","scenes":[{"label":"...","text":"...","caption":"...","duration":3}]}.`;
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-6-astra",
        input: prompt,
        text: { format: { type: "json_object" } }
      })
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.error?.message || "OpenAI API request failed." });
    const output = (data.output || []).flatMap(x => x.content || []).filter(x => x.type === "output_text").map(x => x.text).join("\n") || data.output_text || "";
    const parsed = JSON.parse(output);
    if (!parsed.hook || !parsed.script || !Array.isArray(parsed.scenes)) throw new Error("GPT response did not match the expected script schema.");
    res.json(parsed);
  } catch (e) { res.status(500).json({ error: e.message || "GPT script generation failed." }); }
});

app.post("/api/elevenlabs/tts", async (req, res) => {
  try {
    if (!process.env.ELEVENLABS_API_KEY) return res.status(503).json({ error: "ELEVENLABS_API_KEY غير مهيأ على الخادم." });
    const text = String(req.body?.text || "").trim();
    const voiceId = String(req.body?.voiceId || process.env.ELEVENLABS_DEFAULT_VOICE_ID || "").trim();
    if (!text || text.length > 5000) return res.status(400).json({ error: "النص مطلوب وبحد أقصى 5000 حرف." });
    if (!/^[A-Za-z0-9_-]{5,80}$/.test(voiceId)) return res.status(400).json({ error: "أدخل Voice ID صحيحاً." });
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "Content-Type": "application/json", "Accept": "audio/mpeg" },
      body: JSON.stringify({
        text,
        model_id: process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2",
        voice_settings: { stability: 0.45, similarity_boost: 0.78, style: 0.2, use_speaker_boost: true }
      })
    });
    if (!r.ok) {
      const detail = await r.text();
      return res.status(r.status).json({ error: `ElevenLabs: ${detail.slice(0, 400)}` });
    }
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Disposition", 'inline; filename="autovira-arabic-voice.mp3"');
    res.send(Buffer.from(await r.arrayBuffer()));
  } catch (e) { res.status(500).json({ error: e.message || "ElevenLabs TTS failed." }); }
});

app.post("/api/fal/image", async (req, res) => {
  try {
    if (!process.env.FAL_KEY) return res.status(503).json({ error: "FAL_KEY غير مهيأ على الخادم." });
    const prompt = String(req.body?.prompt || "").trim();
    if (!prompt || prompt.length > 1800) return res.status(400).json({ error: "وصف الصورة مطلوب وبحد أقصى 1800 حرف." });
    fal.config({ credentials: process.env.FAL_KEY });
    const result = await fal.subscribe(process.env.FAL_IMAGE_MODEL || "fal-ai/flux/schnell", {
      input: { prompt, image_size: "portrait_4_3", num_images: 1, enable_safety_checker: true },
      logs: false
    });
    const url = result?.data?.images?.[0]?.url;
    if (!url) return res.status(502).json({ error: "لم يرجع نموذج الصور رابطاً صالحاً." });
    res.json({ url, proxyUrl: `/api/fal/image-proxy?url=${encodeURIComponent(url)}` });
  } catch (e) { res.status(500).json({ error: e.message || "fal.ai image generation failed." }); }
});

app.get("/api/fal/image-proxy", async (req, res) => {
  try {
    const u = new URL(String(req.query.url || ""));
    if (!(u.hostname === "fal.media" || u.hostname.endsWith(".fal.media"))) return res.status(400).send("Image host is not allowed.");
    const r = await fetch(u, { signal: AbortSignal.timeout(20_000) });
    if (!r.ok) return res.status(r.status).send("Could not retrieve generated image.");
    const type = r.headers.get("content-type") || "";
    if (!type.startsWith("image/")) return res.status(415).send("Expected an image resource.");
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 15 * 1024 * 1024) return res.status(413).send("Image is larger than 15MB.");
    res.setHeader("Content-Type", type);
    res.setHeader("Cache-Control", "private, max-age=300");
    res.send(buf);
  } catch (e) { res.status(500).send(e.message); }
});

app.get("/api/pexels/videos", async (req, res) => {
  try {
    if (!process.env.PEXELS_API_KEY) return res.status(503).json({ error: "PEXELS_API_KEY غير مهيأ. يمكنك استخدام رفع B-roll المحلي." });
    const query = String(req.query.query || "").trim();
    if (!query || query.length > 100) return res.status(400).json({ error: "اكتب عبارة بحث قصيرة." });
    const u = new URL("https://api.pexels.com/v1/videos/search");
    u.searchParams.set("query", query);
    u.searchParams.set("orientation", "portrait");
    u.searchParams.set("per_page", "8");
    const r = await fetch(u, { headers: { Authorization: process.env.PEXELS_API_KEY } });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.error || "Pexels API request failed." });
    const videos = (data.videos || []).map(v => ({
      id: v.id, url: v.url, image: v.image, duration: v.duration, user: v.user?.name,
      files: (v.video_files || []).map(f => ({ width: f.width, height: f.height, quality: f.quality, link: f.link }))
    }));
    res.json({ videos, totalResults: data.total_results });
  } catch (e) { res.status(500).json({ error: e.message || "Pexels search failed." }); }
});

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "../public/index.html")));
app.listen(PORT, () => console.log(`Autovira V4.1 running on port ${PORT}`));
