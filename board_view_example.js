const { Client } = require("@notionhq/client")
require("dotenv").config()

// Khởi tạo Notion client
const notion = new Client({
  auth: process.env.NOTION_TOKEN,
})

async function getBoardViewData() {
  try {
    // 1. Lấy thông tin database để xem các views có sẵn
    console.log("🔍 Đang lấy thông tin database...")
    const database = await notion.databases.retrieve({
      database_id: process.env.DATABASE_ID
    })
    
    console.log("📊 Database title:", database.title[0]?.plain_text || "Untitled")
    // Object.keys là một hàm trong JavaScript dùng để lấy tất cả các key của một object
    console.log("📋 Database properties:", Object.keys(database.properties))
    // 2. Query database để lấy tất cả pages/items
    console.log("\n🔍 Đang query database để lấy dữ liệu...")
    const response = await notion.databases.query({
      database_id: process.env.DATABASE_ID,
      // Có thể thêm filter và sort nếu cần
      // filter: {
      //   property: 'Status',
      //   select: {
      //     equals: 'In Progress'
      //   }
      // },
      // sorts: [
      //   {
      //     property: 'Name',
      //     direction: 'ascending'
      //   }
      // ]
    })
    
    console.log(`📈 Tổng số items: ${response.results.length}`)
    
    // 3. Xử lý dữ liệu theo board view structure
    const boardData = processBoardData(response.results, database.properties)
    // console.log("Board data:", boardData)
    
    // 4. Hiển thị dữ liệu theo board view
    displayBoardView(boardData)
    
    return boardData
    
  } catch (error) {
    console.error("❌ Lỗi khi lấy dữ liệu:", error.message)
    throw error
  }
}

function processBoardData(pages, properties) {
  // Tìm property được sử dụng làm group trong board view
  // Thường là Status, Priority, hoặc các select properties khác
  const groupProperty = findGroupProperty(properties)
  
  if (!groupProperty) {
    console.log("⚠️ Không tìm thấy property phù hợp để group. Hiển thị dữ liệu dạng list.")
    return { "All Items": pages }
  }
  
  console.log(`🎯 Sử dụng property '${groupProperty}' để group dữ liệu`)
  
  // Group pages theo property được chọn
  const groupedData = {}
  
  pages.forEach(page => {
    const groupValue = getPropertyValue(page.properties[groupProperty])
    const groupKey = groupValue || "No Status"
    
    if (!groupedData[groupKey]) {
      groupedData[groupKey] = []
    }
    
    groupedData[groupKey].push(page)
  })
  
  return groupedData
}

function findGroupProperty(properties) {
  // Tìm các properties có thể dùng để group (select, multi-select, status)
  const groupableProperties = ['Status', 'Category', 'Type', 'Stage', 'Priority']
  
  for (const propName of groupableProperties) {
    if (properties[propName]) {
      const prop = properties[propName]
      if (prop.type === 'select' || prop.type === 'multi_select' || prop.type === 'status') {
        return propName
      }
    }
  }
  
  // Nếu không tìm thấy, trả về property select đầu tiên
  for (const [propName, prop] of Object.entries(properties)) {
    if (prop.type === 'select' || prop.type === 'multi_select' || prop.type === 'status') {
      return propName
    }
  }
  
  return null
}

function getPropertyValue(property) {
  if (!property) return null
  
  switch (property.type) {
    case 'title':
      return property.title[0]?.plain_text || "Untitled"
    case 'rich_text':
      return property.rich_text[0]?.plain_text || ""
    case 'select':
      return property.select?.name || null
    case 'multi_select':
      return property.multi_select.map(item => item.name).join(', ')
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

function displayBoardView(boardData) {
  console.log("\n📋 BOARD VIEW DATA:")
  console.log("=".repeat(50))
  
  Object.entries(boardData).forEach(([groupName, items]) => {
    console.log(`\n🏷️  ${groupName} (${items.length} items):`)
    console.log("-".repeat(30))
    
    items.forEach((item, index) => {
      const title = getPropertyValue(item.properties.Name || item.properties.Title || item.properties['Task Name'])
      console.log(`${index + 1}. ${title}`)
      
      // Hiển thị thêm thông tin nếu có
      const status = getPropertyValue(item.properties.Status)
      const priority = getPropertyValue(item.properties.Priority)
      const dueDate = getPropertyValue(item.properties['Due Date'])
      
      if (status) console.log(`   Status: ${status}`)
      if (priority) console.log(`   Priority: ${priority}`)
      if (dueDate) console.log(`   Due: ${dueDate}`)
      console.log("")
    })
  })
}

// Hàm để lấy dữ liệu theo filter cụ thể
async function getFilteredBoardData(filterConfig) {
  try {
    const response = await notion.databases.query({
      database_id: process.env.DATABASE_ID,
      filter: filterConfig
    })
    
    const database = await notion.databases.retrieve({
      database_id: process.env.DATABASE_ID
    })
    
    return processBoardData(response.results, database.properties)
  } catch (error) {
    console.error("❌ Lỗi khi lấy dữ liệu có filter:", error.message)
    throw error
  }
}

// Export các functions để sử dụng
module.exports = {
  getBoardViewData,
  getFilteredBoardData,
  processBoardData
}

// Chạy demo nếu file được execute trực tiếp
if (require.main === module) {
  getBoardViewData()
    .then(() => {
      console.log("\n✅ Hoàn thành!")
    })
    .catch(error => {
      console.error("❌ Có lỗi xảy ra:", error)
      process.exit(1)
    })
} 