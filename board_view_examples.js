const { Client } = require("@notionhq/client")
require("dotenv").config()

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
})

// Ví dụ 1: Lấy dữ liệu theo Status (phổ biến nhất cho board view)
async function getBoardViewByStatus() {
  console.log("🎯 Ví dụ 1: Board View theo Status")
  console.log("=".repeat(40))
  
  try {
    const response = await notion.databases.query({
      database_id: process.env.DATABASE_ID,
      sorts: [
        {
          property: 'Status',
          direction: 'ascending'
        }
      ]
    })
    
    // Group theo Status
    const groupedByStatus = {}
    response.results.forEach(page => {
      const status = page.properties.Status?.status?.name || "No Status"
      if (!groupedByStatus[status]) {
        groupedByStatus[status] = []
      }
      groupedByStatus[status].push(page)
    })
    
    // Hiển thị kết quả
    Object.entries(groupedByStatus).forEach(([status, items]) => {
      console.log(`\n📋 ${status} (${items.length} items):`)
      items.forEach((item, index) => {
        const title = item.properties.Name?.title[0]?.plain_text || 
                     item.properties.Title?.title[0]?.plain_text || 
                     "Untitled"
        console.log(`  ${index + 1}. ${title}`)
      })
    })
    
  } catch (error) {
    console.error("❌ Lỗi:", error.message)
  }
}

// Ví dụ 2: Lấy dữ liệu với filter cụ thể
async function getBoardViewWithFilter() {
  console.log("\n🎯 Ví dụ 2: Board View với Filter")
  console.log("=".repeat(40))
  
  try {
    // Filter chỉ lấy các task có Priority cao
    const response = await notion.databases.query({
      database_id: process.env.DATABASE_ID,
      filter: {
        property: 'Priority',
        select: {
          equals: 'High'
        }
      }
    })
    
    console.log(`📊 Tìm thấy ${response.results.length} tasks có Priority High`)
    
    response.results.forEach((item, index) => {
      const title = item.properties.Name?.title[0]?.plain_text || 
                   item.properties.Title?.title[0]?.plain_text || 
                   "Untitled"
      const status = item.properties.Status?.status?.name || "No Status"
      console.log(`${index + 1}. ${title} - Status: ${status}`)
    })
    
  } catch (error) {
    console.error("❌ Lỗi:", error.message)
  }
}

// Ví dụ 3: Lấy dữ liệu theo Date range
async function getBoardViewByDateRange() {
  console.log("\n🎯 Ví dụ 3: Board View theo Date Range")
  console.log("=".repeat(40))
  
  try {
    const today = new Date()
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
    
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
      },
      sorts: [
        {
          property: 'Due Date',
          direction: 'ascending'
        }
      ]
    })
    
    console.log(`📅 Tasks due trong 7 ngày tới: ${response.results.length}`)
    
    response.results.forEach((item, index) => {
      const title = item.properties.Name?.title[0]?.plain_text || 
                   item.properties.Title?.title[0]?.plain_text || 
                   "Untitled"
      const dueDate = item.properties['Due Date']?.date?.start || "No due date"
      console.log(`${index + 1}. ${title} - Due: ${dueDate}`)
    })
    
  } catch (error) {
    console.error("❌ Lỗi:", error.message)
  }
}

// Ví dụ 4: Lấy dữ liệu với multiple filters
async function getBoardViewWithMultipleFilters() {
  console.log("\n🎯 Ví dụ 4: Board View với Multiple Filters")
  console.log("=".repeat(40))
  
  try {
    const response = await notion.databases.query({
      database_id: process.env.DATABASE_ID,
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
      },
      sorts: [
        {
          property: 'Priority',
          direction: 'descending'
        },
        {
          property: 'Name',
          direction: 'ascending'
        }
      ]
    })
    
    console.log(`🚀 Active tasks với Priority cao: ${response.results.length}`)
    
    // Group theo Priority
    const groupedByPriority = {}
    response.results.forEach(page => {
      const priority = page.properties.Priority?.select?.name || "No Priority"
      if (!groupedByPriority[priority]) {
        groupedByPriority[priority] = []
      }
      groupedByPriority[priority].push(page)
    })
    
    Object.entries(groupedByPriority).forEach(([priority, items]) => {
      console.log(`\n🔥 ${priority} Priority (${items.length} items):`)
      items.forEach((item, index) => {
        const title = item.properties.Name?.title[0]?.plain_text || 
                     item.properties.Title?.title[0]?.plain_text || 
                     "Untitled"
        const status = item.properties.Status?.status?.name || "No Status"
        console.log(`  ${index + 1}. ${title} - ${status}`)
      })
    })
    
  } catch (error) {
    console.error("❌ Lỗi:", error.message)
  }
}

// Ví dụ 5: Lấy dữ liệu với pagination
async function getBoardViewWithPagination() {
  console.log("\n🎯 Ví dụ 5: Board View với Pagination")
  console.log("=".repeat(40))
  
  try {
    let allResults = []
    let hasMore = true
    let startCursor = undefined
    
    while (hasMore) {
      const response = await notion.databases.query({
        database_id: process.env.DATABASE_ID,
        start_cursor: startCursor,
        page_size: 10 // Lấy 10 items mỗi lần
      })
      
      allResults = allResults.concat(response.results)
      hasMore = response.has_more
      startCursor = response.next_cursor
      
      console.log(`📄 Đã lấy ${allResults.length} items...`)
    }
    
    console.log(`\n📊 Tổng cộng: ${allResults.length} items`)
    
    // Group theo Status
    const groupedByStatus = {}
    allResults.forEach(page => {
      const status = page.properties.Status?.status?.name || "No Status"
      if (!groupedByStatus[status]) {
        groupedByStatus[status] = []
      }
      groupedByStatus[status].push(page)
    })
    
    Object.entries(groupedByStatus).forEach(([status, items]) => {
      console.log(`\n📋 ${status}: ${items.length} items`)
    })
    
  } catch (error) {
    console.error("❌ Lỗi:", error.message)
  }
}

// Chạy tất cả ví dụ
async function runAllExamples() {
  console.log("🚀 Bắt đầu chạy các ví dụ Board View...\n")
  
  await getBoardViewByStatus()
  await getBoardViewWithFilter()
  await getBoardViewByDateRange()
  await getBoardViewWithMultipleFilters()
  await getBoardViewWithPagination()
  
  console.log("\n✅ Hoàn thành tất cả ví dụ!")
}

// Export functions
module.exports = {
  getBoardViewByStatus,
  getBoardViewWithFilter,
  getBoardViewByDateRange,
  getBoardViewWithMultipleFilters,
  getBoardViewWithPagination,
  runAllExamples
}

// Chạy nếu file được execute trực tiếp
if (require.main === module) {
  runAllExamples()
    .catch(error => {
      console.error("❌ Có lỗi xảy ra:", error)
      process.exit(1)
    })
} 