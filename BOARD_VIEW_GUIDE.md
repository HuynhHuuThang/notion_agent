# Hướng dẫn lấy dữ liệu từ Board Views trong Notion Database

## 📋 Tổng quan

Board Views trong Notion là cách hiển thị dữ liệu dạng Kanban board, thường được group theo một property cụ thể (như Status, Priority, Category, etc.). Tài liệu này hướng dẫn cách lấy dữ liệu từ board views bằng Notion API.

## 🚀 Cách sử dụng

### 1. Setup cơ bản

Đảm bảo bạn đã có:
- `NOTION_TOKEN` trong file `.env`
- `DATABASE_ID` trong file `.env`

### 2. Chạy ví dụ cơ bản

```bash
node board_view_example.js
```

### 3. Chạy các ví dụ nâng cao

```bash
node board_view_examples.js
```

## 📊 Các loại Board View

### 1. Board View theo Status (Phổ biến nhất)
```javascript
// Lấy tất cả items và group theo Status
const response = await notion.databases.query({
  database_id: process.env.DATABASE_ID,
  sorts: [
    {
      property: 'Status',
      direction: 'ascending'
    }
  ]
})
```

### 2. Board View với Filter
```javascript
// Chỉ lấy items có Priority cao
const response = await notion.databases.query({
  database_id: process.env.DATABASE_ID,
  filter: {
    property: 'Priority',
    select: {
      equals: 'High'
    }
  }
})
```

### 3. Board View theo Date Range
```javascript
// Lấy items có due date trong 7 ngày tới
const response = await notion.databases.query({
  database_id: process.env.DATABASE_ID,
  filter: {
    and: [
      {
        property: 'Due Date',
        date: {
          on_or_after: today.toISOString().split('T')[0]
        }
      },
      {
        property: 'Due Date',
        date: {
          on_or_before: nextWeek.toISOString().split('T')[0]
        }
      }
    ]
  }
})
```

## 🔧 Các Filter phổ biến

### Filter theo Status
```javascript
filter: {
  property: 'Status',
  status: {
    equals: 'In Progress'
  }
}
```

### Filter theo Priority
```javascript
filter: {
  property: 'Priority',
  select: {
    equals: 'High'
  }
}
```

### Filter theo Date
```javascript
filter: {
  property: 'Due Date',
  date: {
    on_or_after: '2024-01-01'
  }
}
```

### Multiple Filters
```javascript
filter: {
  and: [
    {
      property: 'Status',
      status: {
        does_not_equal: 'Done'
      }
    },
    {
      property: 'Priority',
      select: {
        does_not_equal: 'Low'
      }
    }
  ]
}
```

## 📈 Cách xử lý dữ liệu Board View

### 1. Group dữ liệu theo property
```javascript
function groupByProperty(pages, propertyName) {
  const grouped = {}
  
  pages.forEach(page => {
    const value = getPropertyValue(page.properties[propertyName])
    const key = value || "No Value"
    
    if (!grouped[key]) {
      grouped[key] = []
    }
    
    grouped[key].push(page)
  })
  
  return grouped
}
```

### 2. Lấy giá trị từ properties
```javascript
function getPropertyValue(property) {
  if (!property) return null
  
  switch (property.type) {
    case 'title':
      return property.title[0]?.plain_text || "Untitled"
    case 'select':
      return property.select?.name || null
    case 'status':
      return property.status?.name || null
    case 'date':
      return property.date?.start || null
    case 'checkbox':
      return property.checkbox ? "Yes" : "No"
    default:
      return JSON.stringify(property)
  }
}
```

## 🎯 Các trường hợp sử dụng thực tế

### 1. Kanban Board cho Task Management
- Group theo Status: To Do, In Progress, Done
- Filter theo Priority
- Sort theo Due Date

### 2. Project Management
- Group theo Project/Client
- Filter theo Team Member
- Sort theo Deadline

### 3. Content Management
- Group theo Category
- Filter theo Status (Draft, Review, Published)
- Sort theo Creation Date

## ⚠️ Lưu ý quan trọng

1. **Property Names**: Đảm bảo tên property trong code khớp với tên trong Notion database
2. **API Limits**: Notion API có giới hạn 100 items mỗi request, sử dụng pagination cho datasets lớn
3. **Rate Limits**: Không gọi API quá nhanh để tránh bị rate limit
4. **Error Handling**: Luôn xử lý lỗi khi gọi API

## 🔍 Debug và Troubleshooting

### Kiểm tra Database Properties
```javascript
const database = await notion.databases.retrieve({
  database_id: process.env.DATABASE_ID
})
console.log("Properties:", Object.keys(database.properties))
```

### Kiểm tra Property Types
```javascript
Object.entries(database.properties).forEach(([name, prop]) => {
  console.log(`${name}: ${prop.type}`)
})
```

### Test với một item
```javascript
const response = await notion.databases.query({
  database_id: process.env.DATABASE_ID,
  page_size: 1
})
console.log("Sample item:", JSON.stringify(response.results[0], null, 2))
```

## 📚 Tài liệu tham khảo

- [Notion API Documentation](https://developers.notion.com/)
- [Database Query API](https://developers.notion.com/reference/post-database-query)
- [Filter and Sort](https://developers.notion.com/reference/post-database-query-filter)

## 🚀 Ví dụ hoàn chỉnh

Xem file `board_view_example.js` và `board_view_examples.js` để có ví dụ hoàn chỉnh về cách implement board views. 