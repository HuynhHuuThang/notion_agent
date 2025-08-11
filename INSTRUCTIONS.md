# Hướng dẫn sử dụng Notion Task Creator từ Markdown

## 📋 Tổng quan

Script `create_tasks_from_md.js` cho phép bạn tạo tasks trong Notion database từ file Markdown. Hỗ trợ nhiều định dạng khác nhau và có thể tự động gán due date, status theo ngày trong tuần.

## 🚀 Cài đặt

### 1. Dependencies
```bash
npm install
```

### 2. Cấu hình môi trường
Tạo file `.env` trong thư mục gốc:
```env
# Bắt buộc
NOTION_TOKEN=ntn_your_token_here
DATABASE_ID=your_database_id_here

# Tùy chọn - override tên property nếu DB của bạn khác
TITLE_PROP=Name
DATE_PROP=Due date
STATUS_PROP=Status
DEFAULT_STATUS=Not Started

# Tùy chọn - mapping status theo ngày
STATUS_BY_DAY=Thứ 2: In Progress, Thứ 3: In Progress, Thứ 4: In Progress, Thứ 5: In Progress, Thứ 6: In Progress, Thứ 7: Not Started, Chủ nhật: Not Started

# Tùy chọn - ngày bắt đầu Week 1
WEEK1_START=2025-08-11

# Tùy chọn - từ khóa loại trừ
EXCLUDE_TITLES=Nghỉ, Break, Rest
```

## 📝 Các định dạng Markdown được hỗ trợ

### 1. Checklist với due date
```markdown
- [ ] Task title @2025-08-15
- [ ] Another task (due: 2025-08-16)
- [ ] Third task @15/08/2025
- [ ] Fourth task (due: 15-08-2025)
```

**Hỗ trợ các định dạng ngày:**
- `YYYY-MM-DD` (ISO format)
- `DD/MM/YYYY` (European)
- `DD-MM-YYYY` (European with dash)
- `MM/DD/YYYY` (US format)

### 2. Bảng với Title và Due Date
```markdown
| Title | Due Date |
|-------|----------|
| Task 1 | 2025-08-15 |
| Task 2 | 15/08/2025 |
```

### 3. Lịch theo tuần/ngày (Plan.md style)
```markdown
WEEK1_START: 2025-08-11

### 📅 Week 1 – Kế hoạch học tập

#### Thứ 2
- 08:00 – 09:30: DevOps – Giới thiệu Jenkins
- 09:45 – 11:15: IELTS Listening – Test 1

#### Thứ 3
- 19:00 – 20:30: Python – Biến và kiểu dữ liệu
```

## 🔧 Cách sử dụng

### Lệnh cơ bản
```bash
npm run create-from-md -- --file <đường_dẫn_file.md>
```

### Các tham số chính

#### Bắt buộc
- `--file <path>` hoặc `-f <path>`: Đường dẫn đến file Markdown

#### Tùy chọn
- `--db <id>` hoặc `--database <id>`: Database ID (nếu khác với .env)
- `--title-prop <name>`: Tên property title trong database
- `--date-prop <name>`: Tên property date trong database
- `--status-prop <name>`: Tên property status trong database
- `--status <value>`: Giá trị status cố định cho tất cả tasks
- `--week1-start <YYYY-MM-DD>`: Ngày bắt đầu Week 1 (cho Plan.md)
- `--exclude <phrases>`: Từ khóa loại trừ, phân cách bằng dấu phẩy
- `--dry-run`: Chỉ parse và hiển thị, không tạo task trong Notion

### Ví dụ sử dụng

#### 1. Dry-run để kiểm tra
```bash
npm run create-from-md -- --file Plan.md --week1-start 2025-08-11 --dry-run --exclude Nghỉ
```

#### 2. Tạo task với status cố định
```bash
npm run create-from-md -- --file Plan.md --week1-start 2025-08-11 --date-prop "Due date" --status-prop Status --status "Not Started" --exclude Nghỉ
```

#### 3. Tạo task với status theo ngày
```bash
npm run create-from-md -- --file Plan.md --week1-start 2025-08-11 --date-prop "Due date" --status-prop Status --status-by-day "Thứ 2: In Progress, Thứ 3: In Progress, Thứ 4: In Progress, Thứ 5: In Progress, Thứ 6: In Progress, Thứ 7: Not Started, Chủ nhật: Not Started" --exclude Nghỉ
```

#### 4. Tạo task từ checklist đơn giản
```bash
npm run create-from-md -- --file tasks.md --date-prop "Due date" --status-prop Status --status "To Do"
```

## 🎯 Logic xử lý Status

### 1. Status cố định
Nếu truyền `--status`, tất cả tasks sẽ có status giống nhau.

### 2. Status theo ngày
Nếu truyền `--status-by-day`, status sẽ được gán theo ngày trong tuần:
```bash
--status-by-day "Thứ 2: In Progress, Thứ 3: In Progress, Thứ 4: In Progress, Thứ 5: In Progress, Thứ 6: In Progress, Thứ 7: Not Started, Chủ nhật: Not Started"
```

### 3. Status động theo due date
Nếu không truyền status nào:
- **Hôm nay**: `In Progress`
- **Tương lai**: `Not Started`
- **Quá khứ**: `Done`

## 📊 Cấu trúc Database yêu cầu

Database Notion cần có các properties sau:

### Bắt buộc
- **Title property**: Chứa tên task (thường là `Name` hoặc `Title`)
- **Date property**: Chứa due date (thường là `Due date`, `Due`, hoặc `Deadline`)

### Tùy chọn
- **Status property**: Chứa trạng thái task (thường là `Status`)

## 🔍 Troubleshooting

### Lỗi thường gặp

#### 1. "Thiếu NOTION_TOKEN"
```bash
# Kiểm tra file .env có tồn tại và có NOTION_TOKEN
cat .env
```

#### 2. "Thiếu DATABASE_ID"
```bash
# Thêm vào .env hoặc truyền tham số
--db your_database_id_here
```

#### 3. "Không tìm thấy title property"
```bash
# Chỉ định tên property title
--title-prop "Task Name"
```

#### 4. "Không tìm thấy task nào"
- Kiểm tra định dạng Markdown có đúng không
- Đảm bảo file có nội dung
- Kiểm tra regex pattern có khớp với nội dung không

### Debug

#### 1. Chạy dry-run trước
```bash
npm run create-from-md -- --file your_file.md --dry-run
```

#### 2. Kiểm tra properties database
```bash
node main.js
```

#### 3. Kiểm tra file Markdown
```bash
cat your_file.md
```

## 📚 Ví dụ hoàn chỉnh

### File Markdown mẫu (tasks.md)
```markdown
# Danh sách công việc

## Checklist
- [ ] Hoàn thành báo cáo @2025-08-15
- [ ] Gửi email cho khách hàng (due: 2025-08-16)
- [ ] Họp team @15/08/2025

## Bảng
| Title | Due Date |
|-------|----------|
| Review code | 2025-08-17 |
| Update docs | 17-08-2025 |
```

### Lệnh chạy
```bash
npm run create-from-md -- --file tasks.md --date-prop "Due date" --status-prop Status --status "Not Started"
```

## 🚀 Tính năng nâng cao

### 1. Loại trừ tasks
```bash
--exclude "Nghỉ, Break, Rest, Coffee"
```

### 2. Mapping status phức tạp
```bash
--status-by-day "Thứ 2: In Progress, Thứ 3: In Progress, Thứ 4: Review, Thứ 5: In Progress, Thứ 6: Done, Thứ 7: Not Started, Chủ nhật: Not Started"
```

### 3. Sử dụng biến môi trường
```env
# .env
STATUS_BY_DAY=Thứ 2: In Progress, Thứ 3: In Progress, Thứ 4: In Progress, Thứ 5: In Progress, Thứ 6: In Progress, Thứ 7: Not Started, Chủ nhật: Not Started
EXCLUDE_TITLES=Nghỉ, Break, Rest
```

## 📝 Ghi chú

- Script hỗ trợ tiếng Việt trong tên ngày
- Có thể chạy `--dry-run` mà không cần NOTION_TOKEN
- Hỗ trợ nhiều định dạng ngày tháng
- Tự động detect properties database
- Có thể tùy chỉnh tên properties
- Hỗ trợ loại trừ tasks theo từ khóa

## 🔗 Liên kết

- [Notion API Documentation](https://developers.notion.com/)
- [Database Query API](https://developers.notion.com/reference/post-database-query)
- [Pages Create API](https://developers.notion.com/reference/post-page)
