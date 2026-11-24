import { esc, icon, date } from "../ui.js";
import { renderDiscussionsAvatar, bindDiscussionsAvatars } from "./discussions-avatar.js";

// These pure exports are also consumed by the server to keep limits and URL policy identical.
export const DISCUSSION_LIMITS = Object.freeze({
  nickname: 16, text: 2000, links: 3, images: 3, pageSize: 20,
  imageBytes: 1024 * 1024, imageEdge: 2048, imagePixels: 2048 * 2048,
  audioBytes: 2 * 1024 * 1024, audioRate: 16000, audioSeconds: 60,
  totalBytes: 5 * 1024 * 1024, uploadBytes: 8 * 1024 * 1024,
});

export function normalizeDiscussionLink(value) {
  if (typeof value !== "string" || value.length > 2048 || /[\u0000-\u0020\u007f-\u009f]/u.test(value))
    throw new Error("请填写完整的 HTTP 或 HTTPS 链接。");
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password)
    throw new Error("链接仅支持 HTTP 或 HTTPS，且不能包含账号密码。");
  return url.href;
}

const uid = () => globalThis.crypto.randomUUID();
const uploadError = (message) => new Error(message);
const audioContextType = () => globalThis.AudioContext || globalThis.webkitAudioContext;
const button = (action, label, extra = "", attrs = "") =>
  `<button type="button" data-discussions-action="${action}" class="discussions-button ${extra}" ${attrs}>${label}</button>`;
const discussionIcon = (name) => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${{
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 16 5-5 5 5 3-3 5 5"/>',
  mic: '<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2m-7 9v3m-4 0h8"/>',
  link: '<path d="m10 13 4-4m-6 6-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 2 1-1a4 4 0 1 1 6 6l-4 4a4 4 0 0 1-6 0"/>',
}[name]}</svg>`;

function readDataUri(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(uploadError("文件读取失败，请重新选择。"));
    reader.onabort = () => reject(uploadError("文件读取已取消。"));
    reader.readAsDataURL(blob);
  });
}

function imageHeaderSize(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (at, size) => String.fromCharCode(...bytes.slice(at, at + size));
  if (bytes.length >= 24 && bytes[0] === 137 && text(1, 3) === "PNG" && text(12, 4) === "IHDR")
    return [view.getUint32(16), view.getUint32(20)];
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
    let at = 2;
    while (at + 4 < bytes.length) {
      if (bytes[at++] !== 255) break;
      while (bytes[at] === 255) at++;
      const marker = bytes[at++];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 1 || marker >= 0xd0 && marker <= 0xd7) continue;
      if (at + 2 > bytes.length) break;
      const size = view.getUint16(at);
      if (size < 2 || at + size > bytes.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && size >= 7)
        return [view.getUint16(at + 5), view.getUint16(at + 3)];
      at += size;
    }
  }
  if (bytes.length >= 30 && text(0, 4) === "RIFF" && text(8, 4) === "WEBP") {
    let at = 12;
    while (at + 8 <= bytes.length) {
      const kind = text(at, 4), size = view.getUint32(at + 4, true), start = at + 8;
      if (start + size > bytes.length) break;
      if (kind === "VP8X" && size >= 10) return [1 + bytes[start + 4] + (bytes[start + 5] << 8) + (bytes[start + 6] << 16), 1 + bytes[start + 7] + (bytes[start + 8] << 8) + (bytes[start + 9] << 16)];
      if (kind === "VP8 " && size >= 10 && text(start + 3, 3) === "\x9d\x01\x2a") return [view.getUint16(start + 6, true) & 0x3fff, view.getUint16(start + 8, true) & 0x3fff];
      if (kind === "VP8L" && size >= 5 && bytes[start] === 0x2f) {
        const bits = view.getUint32(start + 1, true);
        return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1];
      }
      at = start + size + (size % 2);
    }
  }
  throw uploadError("图片内容与支持的格式不符。");
}

export async function normalizeDiscussionImage(file) {
  if (!file || !["image/png", "image/jpeg", "image/webp"].includes(file.type) || !file.size || file.size > DISCUSSION_LIMITS.uploadBytes)
    throw uploadError("请选择 8 MiB 以内的 PNG、JPEG 或 WebP 图片。");
  // Check declared pixel bounds before invoking a decoder that may allocate the full image.
  const [sourceWidth, sourceHeight] = imageHeaderSize(new Uint8Array(await file.arrayBuffer()));
  if (!sourceWidth || !sourceHeight || sourceWidth > 8192 || sourceHeight > 8192 || sourceWidth * sourceHeight > 16 * 1024 * 1024)
    throw uploadError("图片像素过大，请先缩小到 1600 万像素以内。");
  let image;
  let sourceUrl;
  try {
    if (globalThis.createImageBitmap) image = await createImageBitmap(file);
    else {
      sourceUrl = URL.createObjectURL(file);
      image = new Image();
      image.src = sourceUrl;
      await image.decode();
    }
    const width = image.width || image.naturalWidth;
    const height = image.height || image.naturalHeight;
    if (!width || !height || width > 8192 || height > 8192 || width * height > 16 * 1024 * 1024)
      throw uploadError("图片像素过大，请先缩小到 1600 万像素以内。");
    const canvas = document.createElement("canvas");
    let ratio = Math.min(1, DISCUSSION_LIMITS.imageEdge / width, DISCUSSION_LIMITS.imageEdge / height);
    let blob;
    do {
      canvas.width = Math.max(1, Math.floor(width * ratio));
      canvas.height = Math.max(1, Math.floor(height * ratio));
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw uploadError("图片转换失败，请重新选择。");
      ratio *= 0.75;
    } while (blob.size > DISCUSSION_LIMITS.imageBytes && Math.max(canvas.width, canvas.height) > 256);
    if (blob.size > DISCUSSION_LIMITS.imageBytes) throw uploadError("图片转换后仍超过 1 MiB，请缩小后重试。");
    return { dataUri: await readDataUri(blob), alt: (file.name || "讨论配图").slice(0, 120), bytes: blob.size, width: canvas.width, height: canvas.height };
  } catch (error) {
    if (error.message?.includes("图片")) throw error;
    throw uploadError("图片无法解码，请重新选择 PNG、JPEG 或 WebP 图片。");
  } finally {
    image?.close?.();
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  }
}

export function encodeDiscussionWav(buffer, { trimToLimit = false } = {}) {
  if (!Number.isFinite(buffer.duration) || buffer.duration <= 0 || (!trimToLimit && buffer.duration > DISCUSSION_LIMITS.audioSeconds) ||
      !buffer.length || buffer.numberOfChannels < 1 || buffer.numberOfChannels > 2 || buffer.sampleRate < 8000 || buffer.sampleRate > 192000)
    throw uploadError("请选择 60 秒以内的单声道或双声道音频。");
  const count = Math.max(1, Math.min(DISCUSSION_LIMITS.audioSeconds * DISCUSSION_LIMITS.audioRate, Math.floor(buffer.length * DISCUSSION_LIMITS.audioRate / buffer.sampleRate)));
  const bytes = new ArrayBuffer(44 + count * 2);
  const view = new DataView(bytes);
  const write = (at, text) => { for (let i = 0; i < text.length; i++) view.setUint8(at + i, text.charCodeAt(i)); };
  write(0, "RIFF"); view.setUint32(4, bytes.byteLength - 8, true); write(8, "WAVEfmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, DISCUSSION_LIMITS.audioRate, true); view.setUint32(28, DISCUSSION_LIMITS.audioRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, "data"); view.setUint32(40, count * 2, true);
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, channel) => buffer.getChannelData(channel));
  const step = buffer.sampleRate / DISCUSSION_LIMITS.audioRate;
  for (let i = 0; i < count; i++) {
    const from = Math.min(buffer.length - 1, Math.floor(i * step));
    const to = Math.min(buffer.length, Math.max(from + 1, Math.floor((i + 1) * step)));
    let sample = 0;
    for (const channel of channels) for (let j = from; j < to; j++) sample += channel[j];
    sample = Math.max(-1, Math.min(1, sample / channels.length / (to - from)));
    view.setInt16(44 + i * 2, sample < 0 ? sample * 32768 : sample * 32767, true);
  }
  return new Blob([bytes], { type: "audio/wav" });
}

async function inspectAudioDuration(file) {
  const audio = new Audio();
  const source = URL.createObjectURL(file);
  let timer;
  try {
    const duration = await new Promise((resolve, reject) => {
      audio.preload = "metadata";
      audio.onloadedmetadata = () => resolve(audio.duration);
      audio.onerror = () => reject(uploadError("音频无法解码，请重新选择文件。"));
      timer = setTimeout(() => reject(uploadError("无法读取音频时长，请使用 WAV 或 MP3 文件重试。")), 8000);
      audio.src = source;
      audio.load();
    });
    if (!Number.isFinite(duration) || duration <= 0) throw uploadError("无法确定音频时长，请使用 WAV 或 MP3 文件重试。");
    if (duration > DISCUSSION_LIMITS.audioSeconds) throw uploadError("请选择 60 秒以内的音频。");
  } finally {
    clearTimeout(timer); audio.onloadedmetadata = null; audio.onerror = null;
    audio.removeAttribute("src"); audio.load(); URL.revokeObjectURL(source);
  }
}

export async function normalizeDiscussionAudio(file, { recorded = false } = {}) {
  const supported = ["audio/wav", "audio/x-wav", "audio/wave", "audio/mpeg", "audio/mp3", "audio/ogg", "application/ogg", "audio/webm", "audio/mp4", "audio/x-m4a"];
  if (!file?.size || file.size > DISCUSSION_LIMITS.uploadBytes || !supported.includes(file.type.split(";")[0]))
    throw uploadError("请选择 8 MiB 以内的 WAV、MP3、Ogg、WebM 或 M4A 音频。");
  const Context = audioContextType();
  if (!Context) throw uploadError("当前浏览器无法处理音频，请更换支持 Web Audio 的浏览器。");
  // Uploaded compressed audio must expose a bounded duration before full PCM decoding.
  // Recorder chunks have a controlled source and a 60-second timer instead.
  if (!recorded) await inspectAudioDuration(file);
  let context;
  try {
    context = new Context();
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    const wav = encodeDiscussionWav(buffer, { trimToLimit: recorded });
    if (wav.size > DISCUSSION_LIMITS.audioBytes) throw uploadError("音频转换后超过 2 MiB，请缩短后重试。");
    return { dataUri: await readDataUri(wav), duration: wav.size > 44 ? (wav.size - 44) / (DISCUSSION_LIMITS.audioRate * 2) : 0,
      name: (file.name || "录制的语音").slice(0, 120), bytes: wav.size };
  } catch (error) {
    if (error.message?.includes("音频")) throw error;
    throw uploadError("这段音频无法解码，请换用当前浏览器支持的 WAV、MP3、Ogg、WebM 或 M4A 文件。");
  } finally {
    if (context && context.state !== "closed") await context.close();
  }
}

export function createDiscussionRecorder({ onState, onAudio, onError }) {
  let status = "idle", generation = 0, active, destroyed = false;
  const setState = (value) => { status = value; if (!destroyed) onState(value); };
  const release = (session) => {
    clearTimeout(session?.timer);
    for (const track of session?.stream?.getTracks() ?? []) if (track.readyState !== "ended") track.stop();
  };
  const cancel = () => {
    generation++;
    const session = active;
    active = null;
    if (session) {
      session.cancelled = true;
      try { if (session.recorder?.state !== "inactive") session.recorder?.stop(); } catch { /* Device may already have stopped. */ }
      release(session);
    }
    setState("idle");
  };
  const supported = Boolean(globalThis.navigator?.mediaDevices?.getUserMedia && globalThis.MediaRecorder?.isTypeSupported && audioContextType());
  return {
    supported,
    get status() { return status; },
    async start() {
      if (destroyed || status !== "idle") return;
      if (!supported) { onError("当前浏览器可上传语音，录音需要支持麦克风和 MediaRecorder 的安全页面。"); return; }
      const current = ++generation;
      setState("requesting");
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (destroyed || current !== generation) { release({ stream }); return; }
        const mimeType = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"]
          .find((type) => MediaRecorder.isTypeSupported(type));
        if (!mimeType) throw new Error("format");
        const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 64000 });
        const session = { stream, recorder, chunks: [], bytes: 0, cancelled: false };
        active = session;
        recorder.addEventListener("dataavailable", (event) => {
          if (session.cancelled || !event.data.size) return;
          session.bytes += event.data.size;
          if (session.bytes > DISCUSSION_LIMITS.uploadBytes) { cancel(); onError("录音文件过大，请缩短后重试。"); return; }
          session.chunks.push(event.data);
        });
        recorder.addEventListener("error", () => {
          if (session.cancelled || current !== generation) return;
          cancel(); onError("录音设备出现问题，可以重新录制或上传音频。");
        });
        recorder.addEventListener("stop", async () => {
          release(session);
          if (active === session) active = null;
          if (session.cancelled || current !== generation || destroyed) return;
          setState("processing");
          try {
            const audio = await normalizeDiscussionAudio(new Blob(session.chunks, { type: recorder.mimeType }), { recorded: true });
            if (current === generation && !destroyed) onAudio(audio);
          } catch (error) {
            if (current === generation && !destroyed) onError(error.message);
          } finally { if (current === generation && !destroyed) setState("idle"); }
        }, { once: true });
        recorder.start(1000);
        setState("recording");
        session.timer = setTimeout(() => {
          if (active === session && recorder.state !== "inactive") { setState("processing"); recorder.stop(); release(session); }
        }, DISCUSSION_LIMITS.audioSeconds * 1000);
      } catch (error) {
        release({ stream });
        if (current !== generation || destroyed) return;
        active = null;
        setState("idle");
        onError(error.name === "NotAllowedError" ? "麦克风权限未开启。允许访问后可重新录音，也可以直接上传音频。" : "暂时无法录音，请检查麦克风或直接上传音频。");
      }
    },
    stop() {
      if (status !== "recording" || !active) return;
      const session = active;
      setState("processing");
      try { session.recorder.stop(); release(session); }
      catch { cancel(); onError("录音未能保存，可以重新录制或上传音频。"); }
    },
    cancel,
    destroy() { cancel(); destroyed = true; },
  };
}

function safeMedia(uri, kind) {
  if (typeof uri !== "string" || !uri) return "";
  if (kind === "image" && /^https?:\/\//i.test(uri)) {
    try {
      const parsed = new URL(uri);
      if ((parsed.protocol === "https:" || parsed.protocol === "http:") && parsed.hostname && !parsed.username && !parsed.password) {
        return parsed.href;
      }
    } catch { return ""; }
    return "";
  }
  const prefix = `data:${kind === "image" ? "image/png" : "audio/wav"};base64,`;
  const limit = kind === "image" ? DISCUSSION_LIMITS.imageBytes : DISCUSSION_LIMITS.audioBytes;
  if (!uri.startsWith(prefix) || uri.length > prefix.length + Math.ceil(limit / 3) * 4) return "";
  const payload = uri.slice(prefix.length);
  if (!payload || payload.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(payload)) return "";
  try {
    const head = atob(payload.slice(0, 24));
    if (kind === "image" ? head.slice(0, 8) !== "\x89PNG\r\n\x1a\n" : head.slice(0, 4) !== "RIFF" || head.slice(8, 12) !== "WAVE") return "";
  } catch { return ""; }
  return uri;
}

export function renderDiscussionComment(comment) {
  const name = typeof comment.author?.name === "string" ? comment.author.name : "考生";
  const createdAt = Number.isFinite(comment.createdAt) && Number.isFinite(new Date(comment.createdAt).getTime()) ? comment.createdAt : 0;
  const images = (Array.isArray(comment.images) ? comment.images : []).slice(0, DISCUSSION_LIMITS.images).map((image, index) => {
    const source = safeMedia(image.dataUri, "image");
    return source ? `<button type="button" class="discussions-image-button" data-discussions-action="preview" data-discussions-comment="${esc(comment.id)}" data-discussions-index="${index}" aria-label="查看图片：${esc(image.alt || "讨论配图")}"><img src="${esc(source)}" alt="${esc(image.alt || "讨论配图")}" loading="lazy" width="${Number(image.width) || 160}" height="${Number(image.height) || 120}"/></button>` : "";
  }).join("");
  const links = (Array.isArray(comment.links) ? comment.links : []).slice(0, DISCUSSION_LIMITS.links).map((value) => {
    try { const link = normalizeDiscussionLink(value); return `<a class="discussions-link" href="${esc(link)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">${discussionIcon("link")}<span>${esc(link)}</span><span class="discussions-sr-only">，在新标签页打开</span></a>`; }
    catch { return ""; }
  }).join("");
  const audio = safeMedia(comment.audio?.dataUri, "audio");
  const modBadge = (comment.moderationStatus === "pending" || comment.moderationStatus === "flagged")
    ? '<span class="discussions-mod-badge">审核中</span>' : "";
  return `<article class="discussions-comment" data-discussions-comment-id="${esc(comment.id)}">${renderDiscussionsAvatar({ name, seed: comment.author?.avatarSeed || name })}<div class="discussions-comment-body"><header class="discussions-comment-head"><b>${esc(name)}${modBadge}</b><span>${comment.versionLabel ? `v${esc(comment.versionLabel)} · ` : ""}<time datetime="${new Date(createdAt).toISOString()}">${date(createdAt, true)}</time></span></header>${comment.text ? `<p class="discussions-text">${esc(comment.text)}</p>` : ""}${images ? `<div class="discussions-images">${images}</div>` : ""}${audio ? `<figure class="discussions-audio"><figcaption>${esc(comment.audio.name || "讨论语音")}</figcaption><audio controls preload="none" src="${esc(audio)}" aria-label="${esc(name)}的语音评论">当前浏览器无法播放这段语音。</audio><a href="${esc(audio)}" download="discussion.wav" class="discussions-download">下载语音</a></figure>` : ""}${links ? `<div class="discussions-comment-links">${links}</div>` : ""}</div></article>`;
}

export function createDiscussionsFeature(ctx) {
  const doc = globalThis.document;
  const win = globalThis.window;
  if (!doc || !win) throw new Error("讨论区前端需要浏览器环境。");
  const drafts = new Map(), pages = new Map();
  let root, mountedScope = "", recordingDraft, destroyed = false;
  const scope = () => {
    const attempt = ctx.attempt();
    if (ctx.route()?.page !== "report" || !attempt || attempt.isSample || attempt.paperId === "sample-preview") return null;
    return { paperId: attempt.paperId, guestId: ctx.state().guestId, attemptId: attempt.id, key: `${ctx.state().guestId}:${attempt.paperId}` };
  };
  const draftFor = (target) => {
    if (!drafts.has(target.key)) drafts.set(target.key, { nickname: ctx.state().profile?.name || "", nicknameEdited: false, text: "", linkText: "", images: [], audio: null, error: "", success: "", busy: false, processing: false, clientId: uid(), lastSubmission: "" });
    const draft = drafts.get(target.key);
    if (!draft.nicknameEdited && ctx.state().profile?.name) draft.nickname = ctx.state().profile.name;
    return draft;
  };
  const pageFor = (target) => {
    if (!pages.has(target.key)) pages.set(target.key, { comments: [], total: 0, nextCursor: null, requested: false, loading: false, error: "", pending: null, sequence: 0, localInsertions: new Map() });
    return pages.get(target.key);
  };
  const visible = (target) => !destroyed && root?.isConnected && mountedScope === target.key && scope()?.key === target.key;
  const preserveFocus = (callback) => {
    const focused = doc.activeElement;
    const id = root?.contains(focused) ? focused.id : null;
    const start = focused?.selectionStart, end = focused?.selectionEnd;
    callback();
    if (id) {
      const next = doc.getElementById(id);
      next?.focus({ preventScroll: true });
      if (typeof start === "number" && typeof next?.setSelectionRange === "function") next.setSelectionRange(start, end);
    }
  };
  const recorder = createDiscussionRecorder({
    onState() { if (recordingDraft) paintEditor(recordingDraft); },
    onAudio(audio) {
      if (!recordingDraft) return;
      const draft = draftFor(recordingDraft);
      draft.audio = audio; draft.error = ""; draft.success = "";
    },
    onError(message) {
      if (!recordingDraft) return;
      draftFor(recordingDraft).error = message;
      paintEditor(recordingDraft);
    },
  });

  function paintEditor(target) {
    if (!visible(target)) return;
    const draft = draftFor(target);
    const recording = recordingDraft?.key === target.key ? recorder.status : "idle";
    const blocked = draft.busy || draft.processing || recording !== "idle";
    preserveFocus(() => {
      root.querySelector("[data-discussions-editor]").innerHTML = `<form data-discussions-form aria-label="发表评论" aria-busy="${draft.busy || draft.processing}"><fieldset class="discussions-fields" ${draft.busy ? "disabled" : ""}><div class="discussions-identity">${renderDiscussionsAvatar({ name: draft.nickname || "考生", seed: target.guestId })}<div><label for="discussions-nickname">讨论昵称</label><input id="discussions-nickname" name="nickname" type="text" maxlength="16" required autocomplete="nickname" value="${esc(draft.nickname)}" aria-describedby="discussions-identity-help"/><p id="discussions-identity-help" class="discussions-hint">${ctx.state().profile ? "沿用本机身份，昵称可修改。" : "首次发言时设置昵称，将保存为本机身份。"}</p></div></div><label class="discussions-label" for="discussions-text">说说这套卷的难度或你的疑问</label><textarea id="discussions-text" name="text" rows="3" maxlength="2000">${esc(draft.text)}</textarea><div class="discussions-editor-meta"><span>文字、图片、语音和链接可组合发表</span><span data-discussions-counter>${draft.text.length} / 2000</span></div>${draft.images.length ? `<div class="discussions-draft-images">${draft.images.map((image, index) => `<div class="discussions-draft-image"><img src="${esc(image.dataUri)}" alt="${esc(image.alt)}"/><label for="discussions-alt-${index}">图片 ${index + 1} 的说明</label><input type="text" id="discussions-alt-${index}" data-discussions-alt="${index}" maxlength="120" value="${esc(image.alt)}"/>${button("remove-image", "移除图片", "", `data-discussions-index="${index}"`)}</div>`).join("")}</div>` : ""}${draft.audio ? `<div class="discussions-draft-audio"><label for="discussions-audio-name">语音说明</label><input id="discussions-audio-name" type="text" maxlength="120" value="${esc(draft.audio.name)}"/><audio controls preload="metadata" src="${esc(draft.audio.dataUri)}" aria-label="待发表的语音预览"></audio>${button("remove-audio", "移除语音")}</div>` : ""}<div class="discussions-toolbar">${button("pick-images", `${discussionIcon("image")}添加图片`, "", draft.processing || draft.images.length >= DISCUSSION_LIMITS.images ? "disabled" : "")}${button("pick-audio", `${icon("upload")}上传语音`, "", blocked ? "disabled" : "")}${recorder.supported && recording === "idle" ? button("record", `${discussionIcon("mic")}录音`, "", blocked ? "disabled" : "") : ""}${recording === "recording" ? button("stop-recording", "停止录音", "discussions-recording") : ""}${["requesting", "recording", "processing"].includes(recording) ? button("cancel-recording", "取消录音") : ""}<input type="file" data-discussions-file="images" accept="image/png,image/jpeg,image/webp" multiple hidden tabindex="-1" aria-label="选择讨论图片"/><input type="file" data-discussions-file="audio" accept="audio/wav,audio/x-wav,audio/mpeg,audio/ogg,audio/webm,audio/mp4,audio/x-m4a" hidden tabindex="-1" aria-label="选择讨论音频"/></div>${recording !== "idle" ? `<p class="discussions-hint" role="status">${{ requesting: "正在请求麦克风权限…", recording: "正在录音，最多 60 秒。", processing: "正在处理录音…" }[recording]}</p>` : ""}<details class="discussions-links-editor" ${draft.linkText ? "open" : ""}><summary>添加链接</summary><label for="discussions-links">链接地址，每行一个，最多 3 个</label><textarea id="discussions-links" name="links" rows="2" maxlength="6200" inputmode="url">${esc(draft.linkText)}</textarea></details><details class="discussions-help"><summary>附件格式与大小</summary><p>图片支持 PNG、JPEG、WebP，原文件不超过 8 MiB，发表时缩至 2048 像素以内，每张不超过 1 MiB，最多 3 张。音频支持当前浏览器可解码的 WAV、MP3、Ogg、WebM、M4A，原文件不超过 8 MiB，最长 60 秒，发表时转换为 WAV。链接支持 HTTP 和 HTTPS。${recorder.supported ? "录音需要允许麦克风权限。" : "当前浏览器可使用上传语音。"}</p></details></fieldset><p class="discussions-error" role="alert" ${draft.error ? "" : "hidden"}>${esc(draft.error)}</p><p class="discussions-success" role="status" ${draft.success ? "" : "hidden"}>${esc(draft.success)}</p><div class="discussions-publish"><span class="discussions-hint" role="status">${draft.processing ? "正在处理附件…" : draft.busy ? "正在发表…" : ""}</span><button type="submit" class="discussions-button discussions-primary" ${blocked ? "disabled" : ""}>${draft.busy ? "正在发表…" : "发表评论"}</button></div></form>`;
      bindDiscussionsAvatars(root);
    });
  }

  function paintList(target) {
    if (!visible(target)) return;
    const page = pageFor(target);
    const list = root.querySelector("[data-discussions-list]");
    root.querySelector("[data-discussions-count]").textContent = page.requested && !page.loading && !page.error ? `${page.total} 条` : "";
    // Keep existing articles mounted so refreshing/pagination does not reset audio playback.
    const wanted = new Set(page.comments.map((comment) => comment.id));
    for (const article of list.querySelectorAll("[data-discussions-comment-id]")) if (!wanted.has(article.dataset.discussionsCommentId)) article.remove();
    let cursor = list.firstElementChild;
    for (const comment of page.comments) {
      let article = Array.from(list.children).find((element) => element.dataset.discussionsCommentId === comment.id);
      if (!article) {
        const template = doc.createElement("template");
        template.innerHTML = renderDiscussionComment(comment);
        article = template.content.firstElementChild;
      }
      if (article !== cursor) list.insertBefore(article, cursor);
      cursor = article.nextElementSibling;
    }
    root.querySelector("[data-discussions-list-status]").innerHTML = `${page.error ? `<p class="discussions-error" role="alert">${esc(page.error)}</p>${button("refresh", "重新加载讨论")}` : page.loading ? '<p class="discussions-hint" role="status">正在读取讨论…</p>' : !page.comments.length ? '<p class="discussions-empty">还没有讨论，来聊聊这套卷吧。</p>' : ""}${page.nextCursor ? button("more", page.loading ? "正在读取…" : "加载更早的讨论", "", page.loading ? "disabled" : "") : ""}`;
    bindDiscussionsAvatars(root);
  }

  async function load(target, more = false) {
    const page = pageFor(target);
    if (page.pending) return page.pending;
    if (more && !page.nextCursor) return;
    const sequence = page.sequence;
    page.requested = true; page.loading = true; page.error = ""; paintList(target);
    const params = new URLSearchParams({ paperId: target.paperId, guestId: target.guestId, attemptId: target.attemptId });
    if (more) params.set("before", page.nextCursor);
    page.pending = (async () => {
      try {
        const result = await ctx.api(`discussions?${params}`);
        if (result.paperId !== target.paperId || !Array.isArray(result.comments)) throw new Error("讨论数据无法识别，请重试。");
        const publishedWhileLoading = page.comments.filter((comment) => (page.localInsertions.get(comment.id) || 0) > sequence);
        const incoming = more ? [...page.comments, ...result.comments] : [...publishedWhileLoading, ...result.comments];
        page.comments = [...new Map(incoming.map((comment) => [comment.id, comment])).values()];
        page.total = Math.max(result.total, page.total, page.comments.length); page.nextCursor = result.nextCursor;
      } catch (error) { page.error = error.message || "暂时无法读取讨论，请重试。"; }
      finally { page.loading = false; page.pending = null; paintList(target); }
    })();
    return page.pending;
  }

  function afterRender() {
    if (destroyed) return;
    root = doc.querySelector('[data-feature="discussions"]');
    if (!root) { if (recorder.status !== "idle") recorder.cancel(); return; }
    const target = scope();
    if (!target) {
      if (recorder.status !== "idle") recorder.cancel();
      mountedScope = "";
      root.innerHTML = '<section class="discussions discussions-sample"><h2>试卷讨论</h2><p>完成真实试卷并提交后，即可查看和参与这套卷的讨论。</p></section>';
      return;
    }
    if (mountedScope !== target.key || !root.querySelector("[data-discussions-editor]")) {
      mountedScope = target.key;
      root.innerHTML = `<section class="discussions card" aria-labelledby="discussions-heading"><header class="discussions-heading"><h2 id="discussions-heading">试卷讨论 <span data-discussions-count></span></h2>${button("refresh", "刷新讨论")}</header><div data-discussions-editor></div><div class="discussions-list" data-discussions-list></div><div class="discussions-list-status" data-discussions-list-status></div></section>`;
      paintEditor(target); paintList(target);
    }
    if (!pageFor(target).requested) void load(target);
  }

  async function submit(event) {
    if (!event.target.matches("form[data-discussions-form]")) return;
    event.preventDefault();
    const target = scope();
    if (!target || !root?.contains(event.target)) return;
    const draft = draftFor(target);
    if (draft.busy || draft.processing || recorder.status !== "idle") return;
    try {
      const nickname = draft.nickname.trim();
      if (!nickname || nickname.length > DISCUSSION_LIMITS.nickname || /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(nickname))
        throw new Error("请先填写 1–16 字的讨论昵称。");
      const links = draft.linkText.split(/\r?\n/).map((value) => value.trim()).filter(Boolean).map(normalizeDiscussionLink);
      if (links.length > DISCUSSION_LIMITS.links) throw new Error("每条评论最多添加 3 个链接。");
      if (!draft.text.trim() && !links.length && !draft.images.length && !draft.audio) throw new Error("请填写评论或添加附件。");
      const payload = { paperId: target.paperId, guestId: target.guestId, attemptId: target.attemptId, nickname, text: draft.text, links,
        images: draft.images.map(({ dataUri, alt }) => ({ dataUri, alt })), audio: draft.audio ? { dataUri: draft.audio.dataUri, name: draft.audio.name } : null };
      const serialized = JSON.stringify(payload);
      if (draft.lastSubmission && serialized !== draft.lastSubmission) draft.clientId = uid();
      draft.lastSubmission = serialized;
      draft.busy = true; draft.error = ""; draft.success = "";
      ctx.state().profile = { id: target.guestId, name: nickname };
      ctx.persist(); paintEditor(target);
      const result = await ctx.api("discussions", { ...payload, clientId: draft.clientId });
      if (!result.comment?.id || result.comment.paperId !== target.paperId) throw new Error("发表结果无法确认，内容仍保留，请刷新讨论后重试。");
      const page = pageFor(target);
      if (!page.comments.some((comment) => comment.id === result.comment.id)) {
        page.comments.unshift(result.comment); page.total++;
        page.localInsertions.set(result.comment.id, ++page.sequence);
      }
      draft.text = ""; draft.linkText = ""; draft.images = []; draft.audio = null; draft.nicknameEdited = false;
      draft.clientId = uid(); draft.lastSubmission = ""; draft.success = "评论已发表。";
      paintList(target);
    } catch (error) { draft.error = error.message || "发表失败，编辑内容仍保留，请重试。"; }
    finally { draft.busy = false; paintEditor(target); }
  }

  function input(event) {
    const target = scope();
    if (!target || !root?.contains(event.target)) return;
    const draft = draftFor(target), element = event.target;
    if (draft.busy) return;
    if (element.id === "discussions-text") {
      draft.text = element.value;
      root.querySelector("[data-discussions-counter]").textContent = `${element.value.length} / 2000`;
    } else if (element.id === "discussions-nickname") { draft.nickname = element.value; draft.nicknameEdited = true; }
    else if (element.id === "discussions-links") draft.linkText = element.value;
    else if (element.id === "discussions-audio-name" && draft.audio) draft.audio.name = element.value;
    else if (element.hasAttribute("data-discussions-alt")) {
      const image = draft.images[Number(element.dataset.discussionsAlt)];
      if (image) image.alt = element.value;
    } else return;
    draft.success = "";
    const message = root.querySelector(".discussions-success");
    if (message) message.hidden = true;
  }

  async function files(event) {
    const target = scope();
    if (!target || !root?.contains(event.target) || !event.target.matches("[data-discussions-file]")) return;
    const draft = draftFor(target), element = event.target;
    const selected = Array.from(element.files || []);
    element.value = "";
    if (!selected.length || draft.busy || draft.processing) return;
    draft.processing = true; draft.error = ""; draft.success = ""; paintEditor(target);
    try {
      if (element.dataset.discussionsFile === "images") {
        if (draft.images.length + selected.length > DISCUSSION_LIMITS.images) throw new Error("每条评论最多添加 3 张图片，已有图片仍保留。");
        // Commit the selection only after every file succeeds, retaining previous attachments on error.
        const images = [];
        for (const file of selected) images.push(await normalizeDiscussionImage(file));
        draft.images.push(...images);
      } else draft.audio = await normalizeDiscussionAudio(selected[0]);
    } catch (error) { draft.error = error.message; }
    finally { draft.processing = false; paintEditor(target); }
  }

  function click(event) {
    const control = event.target.closest("[data-discussions-action]");
    const target = scope();
    if (!control || !target || !root?.contains(control)) return;
    const draft = draftFor(target);
    if (control.disabled || draft.busy) return;
    const action = control.dataset.discussionsAction;
    if (action === "refresh") { void load(target); return; }
    if (action === "more") { void load(target, true); return; }
    if (action === "pick-images") root.querySelector('[data-discussions-file="images"]').click();
    else if (action === "pick-audio") root.querySelector('[data-discussions-file="audio"]').click();
    else if (action === "remove-image") { draft.images.splice(Number(control.dataset.discussionsIndex), 1); paintEditor(target); }
    else if (action === "remove-audio") { draft.audio = null; paintEditor(target); }
    else if (action === "record") { recordingDraft = target; draft.error = ""; void recorder.start(); }
    else if (action === "stop-recording") recorder.stop();
    else if (action === "cancel-recording") recorder.cancel();
    else if (action === "preview") {
      const comment = pageFor(target).comments.find((item) => item.id === control.dataset.discussionsComment);
      const image = comment?.images?.[Number(control.dataset.discussionsIndex)];
      const source = safeMedia(image?.dataUri, "image");
      if (source) ctx.openModal("讨论配图", `<img class="discussions-full-image" src="${esc(source)}" alt="${esc(image.alt || "讨论配图")}"/>`);
    }
  }
  const onPageHide = () => recorder.cancel();
  doc.addEventListener("submit", submit);
  doc.addEventListener("input", input);
  doc.addEventListener("change", files);
  doc.addEventListener("click", click);
  win.addEventListener("pagehide", onPageHide);
  return {
    afterRender,
    async onRoute() {
      const target = scope();
      // Route cleanup also works when the initial report was mounted by afterRender alone.
      recorder.cancel();
      afterRender();
      if (target) await load(target);
    },
    destroy() {
      destroyed = true; recorder.destroy();
      doc.removeEventListener("submit", submit); doc.removeEventListener("input", input);
      doc.removeEventListener("change", files); doc.removeEventListener("click", click);
      win.removeEventListener("pagehide", onPageHide);
      drafts.clear(); pages.clear(); root = null;
    },
  };
}

// 独立 iOS 视图复用同一地址白名单，避免新页面另写一套媒体校验。
export { safeMedia as safeDiscussionMedia };
