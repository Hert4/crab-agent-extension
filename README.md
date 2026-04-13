# Crab-Agent 🦀

Chrome extension biến trình duyệt thành AI agent. Gõ lệnh bằng tiếng Việt/Anh, nó tự click, gõ, điều hướng, đọc trang — làm hết.

**Version:** 2.3.0 | **License:** MIT

---

## Cài đặt

1. Tải/clone repo này
2. Mở `chrome://extensions` → bật **Developer mode**
3. Click **Load unpacked** → chọn thư mục repo
4. Vào trang bất kỳ → click icon Crab-Agent để mở side panel
5. Vào **Settings** → nhập API key của provider bạn chọn

## Sử dụng

Mở side panel, gõ task bằng ngôn ngữ tự nhiên. Ví dụ:

- *"Tìm vé máy bay rẻ nhất đi Tokyo thứ 6 tuần sau"*
- *"Đọc hết comment trong PR #42 rồi tóm tắt lại"*
- *"Fill form đăng ký với thông tin: tên Hert, email ..."*
- *"Mở 3 tab so sánh giá iPhone trên Shopee, Lazada, Tiki"*

Agent sẽ tự chụp screenshot → đọc DOM → gọi LLM → thực hiện action → lặp lại đến khi xong.

### Permission Modes

| Mode | Mô tả |
|------|-------|
| **Ask** (mặc định) | Hỏi trước khi thao tác trên domain mới |
| **Auto** | Tự động chạy, không hỏi |
| **Strict** | Hỏi từng action một |

### Workflows

- Bấm record → thao tác trên trình duyệt → stop → lưu workflow
- Sau này gõ lệnh liên quan, agent tự gọi workflow đã lưu
- Hỗ trợ parameterize (truyền biến vào workflow)

### Memory

Agent nhớ thông tin bạn chia sẻ giữa các session (tên, preference, rule). Sau vài session, nó tự dọn dẹp memory (dream consolidation) để giữ gọn.

### Scheduler

Đặt lịch task chạy tự động — một lần hoặc lặp lại theo cron. Agent chạy headless qua Chrome alarms.

### Quick Mode

Bật trong Settings. Agent trả lệnh compact thay vì tool call, nhanh hơn cho task đơn giản.

## LLM Providers

| Provider | Ghi chú |
|----------|---------|
| **Anthropic** | Tối ưu nhất. Recommend `claude-opus-4-5` trở lên |
| **OpenAI** | GPT-4o, GPT-4.1 |
| **Google Gemini** | Gemini 2.5 Pro |
| **OpenRouter** | Gateway, dùng model nào cũng được |
| **Ollama** | Chạy local, free |
| **OpenAI-compatible** | Bất kỳ API nào tương thích OpenAI format |

### Model khuyến nghị

Đã test kỹ và tối ưu prompt cho **Claude Opus 4.5** (`claude-opus-4-5`). Các model từ tier này trở lên cho kết quả tốt nhất — ít hallucinate tool call, follow multi-step plan chính xác hơn, xử lý edge case tốt.

Các model nhỏ hơn (Haiku, GPT-4o-mini, Gemini Flash) vẫn chạy được nhưng có thể cần nhiều step hơn hoặc fail ở task phức tạp.

## Tools (30+)

Agent tự chọn tool phù hợp mỗi step:

**Browser:** click, type, scroll, drag, navigate, back/forward, tab create/switch/close
**Page:** read DOM, find element, get text, read console, read network, form fill
**File:** upload, download, image upload
**Advanced:** JavaScript execution, canvas toolkit, code editor, document generator (DOCX/HTML), GIF recorder, SVG visualizer
**Agent:** memory CRUD, suggest rule, update plan, schedule task, run workflow

## Tech Stack

React 18 · TypeScript · Vite · Tailwind CSS · Zustand · Chrome MV3

## Credits

Dự án này có sử dụng và tham khảo từ:

- **[Clawd Tank](https://github.com/marciogranzotto/clawd-tank)** by Marcio Granzotto — mascot "Clawd" crab pixel-art và SVG animations
- **Claude Computer Use** (Anthropic) — tham khảo agent loop logic và browser automation pattern (screenshot → observe → decide → act)

---

Built by [Hert4](https://github.com/Hert4)
