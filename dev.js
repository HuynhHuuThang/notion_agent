const { Client } = require("@notionhq/client")
require("dotenv").config()


// Initializing a client
const notion = new Client({
  auth: process.env.NOTION_TOKEN,
})

async function main() {
  try {
    // 1. Lấy thông tin database để xem các views có sẵn
    console.log("🔍 Đang lấy thông tin database...")
    const database = await notion.databases.retrieve({
      database_id: process.env.DATABASE_ID
    })
    
    console.log("📊 Database title:", database.title[0]?.plain_text || "Untitled")
    console.log("📋 Database properties:", Object.keys(database.properties)) // Object.keys là một hàm trong JavaScript dùng để lấy tất cả các key của một object
    console.log("Database properties:", database.properties)
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
    console.log(response.results)
    
  } catch (error) {
    console.error("❌ Lỗi khi lấy dữ liệu:", error.message)
    throw error
  }
}

main()