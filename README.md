# PivotAssist: Nền tảng luyện phỏng vấn và kết nối tuyển dụng

Nền tảng hỗ trợ luyện tập phỏng vấn kỹ thuật bằng giọng nói và video với AI, tích hợp phòng phỏng vấn trực tiếp cho doanh nghiệp.

---

## 1. Lý do ra đời dự án

Dự án này xuất phát từ chính trải nghiệm thực tế của mình: mình rất sợ và hay bị tâm lý mỗi khi đi phỏng vấn.

Mỗi lần ngồi trước nhà tuyển dụng, mình thường gặp các vấn đề:

- Bị khớp và mất bình tĩnh, dẫn đến nói năng ngắt quãng dù đã chuẩn bị kiến thức.
- Khó diễn đạt câu trả lời mạch lạc theo cấu trúc rõ ràng khi bị hỏi dồn dập.
- Thiếu môi trường cọ xát thực tế, chỉ có thể tự đọc câu hỏi trên mạng rồi nhẩm trong đầu.

Vì lý do đó, mình xây dựng PivotAssist như một phòng tập cá nhân. Ứng viên có thể mở máy lên nói chuyện với AI như một buổi phỏng vấn thật, nghe câu hỏi bằng tiếng Việt, nhận phản hồi về nội dung câu trả lời và ngôn ngữ cơ thể. Mục tiêu đơn giản là luyện tập thật nhiều lần để bớt sợ, tự tin hơn trước khi bước vào buổi phỏng vấn chính thức.

---

## 2. Các chức năng chính

### Dành cho ứng viên

- **Phân tích hồ sơ CV:** Tải lên CV dạng PDF hoặc text, hệ thống tự trích xuất kỹ năng và so khớp độ phù hợp với mô tả công việc.
- **Phòng phỏng vấn AI bằng giọng nói:** Tương tác hai chiều qua micro và loa, nhận diện giọng nói tiếng Việt theo thời gian thực.
- **Theo dõi cử chỉ qua camera:** Đánh giá độ ổn định khung hình, hướng nhìn và mức độ tự tin trong lúc trả lời.
- **Báo cáo và chấm điểm:** Nhận xét chi tiết sau buổi phỏng vấn, chỉ ra điểm trả lời tốt, điểm còn thiếu sót và gợi ý hướng cải thiện.
- **Lộ trình kỹ năng:** Gợi ý danh sách kiến thức cần bổ sung dựa trên kết quả các vòng phỏng vấn.

### Dành cho nhà tuyển dụng

- **Quản lý tin tuyển dụng:** Tạo bài đăng tuyển dụng, thiết lập tiêu chí đánh giá và danh sách câu hỏi phỏng vấn riêng.
- **Xem hồ sơ và kết quả ứng viên:** Xem lại lịch sử phỏng vấn, băng ghi âm và bảng điểm AI của từng ứng viên.
- **Phòng phỏng vấn trực tiếp (Face-to-Face):** Tạo phòng họp trực tuyến qua WebRTC để phỏng vấn vòng 2 trực tiếp với ứng viên.
- **Quy trình gửi Offer:** Theo dõi trạng thái ứng tuyển và gửi lời mời nhận việc ngay trên hệ thống.

---

## 3. Công nghệ sử dụng

Dự án sử dụng mô hình Monorepo quản lý bằng Turborepo và pnpm:

- **Frontend:** Next.js 15 (App Router), React 19, Tailwind CSS.
- **Backend:** NestJS, Node.js, BullMQ, Redis.
- **Cơ sở dữ liệu:** MySQL, Prisma ORM.
- **Realtime & Media:** WebRTC, LiveKit, Google Text-to-Speech.
- **Động cơ AI:**
  - Bộ đánh giá nội bộ (Heuristic Rule-based) chạy trực tiếp trên máy, không tốn phí API.
  - Hỗ trợ mở rộng kết nối Google Gemini khi triển khai môi trường production.

---

## 4. Hướng dẫn cài đặt và chạy thử

### Yêu cầu hệ thống

- Node.js phiên bản 24 trở lên.
- pnpm phiên bản 11 (`corepack enable pnpm`).
- MySQL đang chạy tại cổng `3306`.

### Bước 1: Cài đặt thư viện

```bash
pnpm install
```

### Bước 2: Tạo file môi trường

Sao chép file mẫu:

```bash
cp .env.example .env
```

Điền thông tin kết nối MySQL trong file `.env`:

```env
DATABASE_URL="mysql://root:password@localhost:3306/pivotassist"
JWT_SECRET="mot_chuoi_bi_mat_ngau_nhien_dai_it_nhat_32_ky_tu"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"
FREE_AI_MODE="heuristic"
```

### Bước 3: Khởi tạo database và dữ liệu mẫu

```bash
# Đẩy cấu trúc bảng lên MySQL
pnpm --filter @pivotassist/db db:push

# Nạp dữ liệu mẫu để thử nghiệm
pnpm db:seed
```

_Lưu ý:_ Lệnh seed sẽ tự tạo mật khẩu nội bộ lưu trong `.verify.local.env` (file này đã được gitignore).

- Tài khoản quản trị: `admin@pivotassist.local`
- Tài khoản tuyển dụng: `recruiter@nexusai.local`
- Tài khoản ứng viên: `nam.nguyen@example.com` (Frontend), `quang.tran@example.com` (Backend).

### Bước 4: Khởi chạy dự án

```bash
pnpm dev
```

Mở trình duyệt tại địa chỉ: `http://localhost:3000`

---

## 5. Kiểm tra chất lượng mã nguồn

```bash
# Kiểm tra lỗi kiểu dữ liệu TypeScript
pnpm typecheck

# Chạy toàn bộ 48 bài kiểm thử tự động
pnpm test

# Kiểm tra định dạng code
pnpm lint

# Thử nghiệm build bản chạy thật
pnpm build
```
