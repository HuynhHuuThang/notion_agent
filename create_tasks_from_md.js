const { Client } = require("@notionhq/client")
const fs = require("fs")
const path = require("path")
require("dotenv").config()

// Initialize Notion client lazily to allow --dry-run without token
let notion = null
function getNotionClient() {
  if (!notion) {
    notion = new Client({ auth: process.env.NOTION_TOKEN })
  }
  return notion
}

function parseArgs(argv) {
  const args = {}
  for (let i = 2; i < argv.length; i++) {
    const part = argv[i]
    const next = argv[i + 1]
    if (part.startsWith("--")) {
      const key = part.replace(/^--/, "")
      if (typeof next === "string" && !next.startsWith("--")) {
        args[key] = next
        i++
      } else {
        args[key] = true
      }
    }
  }
  return args
}

function isIsoDate(dateStr) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
}

function normalizeDate(input) {
  if (!input) return null
  const trimmed = String(input).trim()
  if (isIsoDate(trimmed)) return trimmed
  // try DD/MM/YYYY or DD-MM-YYYY
  const m = trimmed.match(/^([0-3]?\d)[/\-]([0-1]?\d)[/\-](\d{4})$/)
  if (m) {
    const dd = m[1].padStart(2, "0")
    const mm = m[2].padStart(2, "0")
    const yyyy = m[3]
    return `${yyyy}-${mm}-${dd}`
  }
  // try MM/DD/YYYY
  const mUs = trimmed.match(/^([0-1]?\d)[/]([0-3]?\d)[/](\d{4})$/)
  if (mUs) {
    const mm = mUs[1].padStart(2, "0")
    const dd = mUs[2].padStart(2, "0")
    const yyyy = mUs[3]
    return `${yyyy}-${mm}-${dd}`
  }
  return null
}

// Parse markdown content for tasks
// Supported formats:
// - "- [ ] Task title @2025-08-15"
// - "- [ ] Task title (due: 2025-08-15)"
// - Table rows with headers including Title and Due (or Due Date)
function parseMarkdownTasks(markdown) {
  const tasks = []
  const lines = markdown.split(/\r?\n/)

  // 1) Checklist patterns
  const checklistPatterns = [
    /^-\s*\[\s*\]\s*(.+?)\s*@\s*(\d{4}-\d{2}-\d{2})\s*$/i,
    /^-\s*\[\s*\]\s*(.+?)\s*\(\s*due(?:\s*date)?\s*:\s*(\d{4}-\d{2}-\d{2})\s*\)\s*$/i,
    /^-\s*\[\s*\]\s*(.+?)\s*@\s*([0-3]?\d[\/\-][0-1]?\d[\/\-]\d{4})\s*$/i,
    /^-\s*\[\s*\]\s*(.+?)\s*\(\s*due(?:\s*date)?\s*:\s*([0-3]?\d[\/\-][0-1]?\d[\/\-]\d{4})\s*\)\s*$/i,
  ]

  for (const line of lines) {
    const trimmed = line.trim()
    for (const re of checklistPatterns) {
      const m = trimmed.match(re)
      if (m) {
        const title = m[1].trim()
        const dateIso = normalizeDate(m[2])
        tasks.push({ title, due: dateIso })
        break
      }
    }
  }

  // 2) Simple pipe table detection
  // Expect header including Title and Due/Due Date
  // Example:
  // | Title | Due Date |
  // | --- | --- |
  // | Do something | 2025-08-15 |
  let inTable = false
  let headerCols = []
  for (const line of lines) {
    if (/^\|/.test(line.trim())) {
      const cols = line
        .trim()
        .split("|")
        .map(c => c.trim())
        .filter(c => c.length > 0)
      if (cols.length >= 2) {
        if (!inTable) {
          headerCols = cols.map(c => c.toLowerCase())
          inTable = true
          continue
        }
        // skip markdown separator row like ---
        if (cols.every(c => /^:?-{3,}:?$/.test(c))) {
          continue
        }
        if (inTable) {
          const titleIdx = headerCols.findIndex(c => /title|name/.test(c))
          const dueIdx = headerCols.findIndex(c => /due(\s*date)?/.test(c))
          if (titleIdx >= 0 && dueIdx >= 0 && cols[titleIdx] && cols[dueIdx]) {
            const title = cols[titleIdx]
            const dateIso = normalizeDate(cols[dueIdx])
            if (title) tasks.push({ title, due: dateIso })
          }
        }
      }
    } else {
      inTable = false
      headerCols = []
    }
  }

  // deduplicate consecutive duplicates
  const seen = new Set()
  const unique = []
  for (const t of tasks) {
    const key = `${t.title}@@${t.due || ""}`
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(t)
    }
  }
  return unique
}

function parseWeekStartFromFile(markdown) {
  const m = markdown.match(/WEEK1_START\s*[:=]\s*(\d{4}-\d{2}-\d{2})/i)
  return m ? m[1] : null
}

function computeDateFromWeekAndDay(week1StartIso, weekNumber, vietnameseDay) {
  if (!week1StartIso) return null
  const base = new Date(week1StartIso + 'T00:00:00Z')
  const dayMap = {
    'thứ 2': 0,
    'thứ hai': 0,
    'thứ 3': 1,
    'thứ ba': 1,
    'thứ 4': 2,
    'thứ tư': 2,
    'thứ 5': 3,
    'thứ năm': 3,
    'thứ 6': 4,
    'thứ sáu': 4,
    'thứ 7': 5,
    'thứ bảy': 5,
    'chủ nhật': 6,
  }
  const key = vietnameseDay.trim().toLowerCase()
  const dayOffsetInWeek = dayMap[key]
  if (dayOffsetInWeek === undefined) return null
  const totalOffset = (Number(weekNumber) - 1) * 7 + dayOffsetInWeek
  const dateMs = base.getTime() + totalOffset * 24 * 60 * 60 * 1000
  const d = new Date(dateMs)
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// Parse schedule-style Plan.md: Week headings, Day headings, and bullet time ranges
function parseScheduleTasks(markdown, week1StartIsoProvided) {
  const tasks = []
  const lines = markdown.split(/\r?\n/)
  let currentWeek = 1
  let currentDayName = null
  const week1StartIso = week1StartIsoProvided || parseWeekStartFromFile(markdown)

  // Build exclude list from CLI/env, comma separated phrases
  const args = parseArgs(process.argv)
  const excludeRaw = args.exclude || process.env.EXCLUDE_TITLES || ""
  const excludePhrases = excludeRaw
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => s.toLowerCase())

  for (const raw of lines) {
    const line = raw.trim()
    // Week heading: e.g., ### 📅 Week 1 – ... or ### 📅 Week 2 –
    const weekMatch = line.match(/^#{2,4}\s*.*?Week\s*(\d+)/i)
    if (weekMatch) {
      currentWeek = Number(weekMatch[1])
      continue
    }
    // Day heading: e.g., #### Thứ 2 ... or #### Chủ nhật
    const dayMatch = line.match(/^#{3,5}\s*(Thứ\s*[2-7]|Thứ\s*(hai|ba|tư|năm|sáu|bảy)|Chủ\s*nhật)/i)
    if (dayMatch) {
      currentDayName = dayMatch[1]
      continue
    }
    // Bullet with time range: "- HH:MM – HH:MM: Title" (supports en dash/em dash/hyphen)
    let bulletMatch = line.match(/^-[\s\t]*\d{1,2}:\d{2}\s*[–—-]\s*\d{1,2}:\d{2}:\s*(.+)$/)
    if (!bulletMatch) {
      // Fallback: any chars between times but ensure second time exists before colon
      bulletMatch = line.match(/^-[\s\t]*\d{1,2}:\d{2}[^\d\n]+\d{1,2}:\d{2}:\s*(.+)$/)
    }
    if (bulletMatch) {
      const title = bulletMatch[1].trim()
      const titleLower = title.toLowerCase()
      if (excludePhrases.some(p => titleLower.includes(p))) {
        continue
      }
      const due = computeDateFromWeekAndDay(week1StartIso, currentWeek, currentDayName || '')
      tasks.push({ title, due, dayName: (currentDayName || '').trim() })
    }
  }

  return tasks
}

function normalizeVietnameseDayName(input) {
  if (!input) return null
  const s = String(input).trim().toLowerCase()
  if (/^chủ\s*nhật$/.test(s)) return 'chủ nhật'
  if (/^thứ\s*(2|hai)$/.test(s)) return 'thứ 2'
  if (/^thứ\s*(3|ba)$/.test(s)) return 'thứ 3'
  if (/^thứ\s*(4|tư)$/.test(s)) return 'thứ 4'
  if (/^thứ\s*(5|năm)$/.test(s)) return 'thứ 5'
  if (/^thứ\s*(6|sáu)$/.test(s)) return 'thứ 6'
  if (/^thứ\s*(7|bảy)$/.test(s)) return 'thứ 7'
  return s
}

function getVietnameseDayNameFromIsoDate(isoDate) {
  if (!isoDate) return null
  const d = new Date(isoDate + 'T00:00:00Z')
  const weekday = d.getUTCDay() // 0=Sun ... 6=Sat
  switch (weekday) {
    case 0: return 'chủ nhật'
    case 1: return 'thứ 2'
    case 2: return 'thứ 3'
    case 3: return 'thứ 4'
    case 4: return 'thứ 5'
    case 5: return 'thứ 6'
    case 6: return 'thứ 7'
    default: return null
  }
}

function parseStatusByDayMapping(mapString) {
  if (!mapString) return null
  const entries = mapString
    .split(/[,;\n]/)
    .map(s => s.trim())
    .filter(Boolean)
  const mapping = {}
  for (const e of entries) {
    const idx = e.indexOf(':')
    if (idx === -1) continue
    const day = normalizeVietnameseDayName(e.slice(0, idx))
    const status = e.slice(idx + 1).trim()
    if (day && status) mapping[day] = status
  }
  return Object.keys(mapping).length ? mapping : null
}

async function detectDatabaseProps(databaseId, explicitTitleProp, explicitDateProp) {
  const db = await getNotionClient().databases.retrieve({ database_id: databaseId })

  let titlePropName = explicitTitleProp || null
  let datePropName = explicitDateProp || null

  if (!titlePropName) {
    for (const [name, prop] of Object.entries(db.properties)) {
      if (prop.type === "title") {
        titlePropName = name
        break
      }
    }
  }

  if (!datePropName) {
    // prefer property explicitly named like Due Date
    const candidates = []
    for (const [name, prop] of Object.entries(db.properties)) {
      if (prop.type === "date") {
        candidates.push(name)
      }
    }
    const preferred = candidates.find(n => /due\s*date|due|deadline/i.test(n))
    datePropName = preferred || candidates[0] || null
  }

  if (!titlePropName) {
    throw new Error("Không tìm thấy title property trong database. Hãy chỉ định bằng --title-prop.")
  }

  return { titlePropName, datePropName }
}

async function createTask(databaseId, titlePropName, datePropName, task, statusPropName, statusValue) {
  const properties = {}
  properties[titlePropName] = {
    title: [
      {
        type: "text",
        text: { content: task.title }
      }
    ]
  }

  if (datePropName && task.due) {
    properties[datePropName] = { date: { start: task.due } }
  }

  if (statusPropName && statusValue) {
    // try set status (works for status/select)
    properties[statusPropName] = { status: { name: statusValue } }
  }

  const page = await getNotionClient().pages.create({
    parent: { database_id: databaseId },
    properties
  })
  return page
}

async function main() {
  const args = parseArgs(process.argv)
  const filePath = args.file || args.f
  let databaseId = args.database || args.db || process.env.DATABASE_ID
  const dryRun = Boolean(args["dry-run"]) || false
  const explicitTitleProp = args["title-prop"] || process.env.TITLE_PROP
  const explicitDateProp = args["date-prop"] || process.env.DATE_PROP
  const statusPropName = args["status-prop"] || process.env.STATUS_PROP
  const statusValue = args.status || process.env.DEFAULT_STATUS
  const statusByDayRaw = args["status-by-day"] || process.env.STATUS_BY_DAY
  const statusByDay = parseStatusByDayMapping(statusByDayRaw)

  if (!dryRun && !databaseId) {
    console.error("❌ Thiếu DATABASE_ID. Thêm vào .env hoặc truyền --db <id>")
    process.exit(1)
  }
  if (dryRun && !databaseId) {
    databaseId = "dry-run"
  }

  if (!filePath) {
    console.error("❌ Thiếu đường dẫn file markdown. Dùng: --file <path>")
    process.exit(1)
  }

  const absPath = path.resolve(filePath)
  if (!fs.existsSync(absPath)) {
    console.error(`❌ Không tìm thấy file: ${absPath}`)
    process.exit(1)
  }

  const content = fs.readFileSync(absPath, "utf8")
  let tasks = parseMarkdownTasks(content)

  // Schedule parser (Plan.md style)
  const week1StartCli = args["week1-start"] || process.env.WEEK1_START
  const scheduleTasks = parseScheduleTasks(content, week1StartCli)
  if (scheduleTasks.length) {
    tasks = tasks.concat(scheduleTasks)
  }

  if (!tasks.length) {
    console.log("⚠️ Không tìm thấy task nào trong file. Hãy dùng checklist '- [ ]' kèm due date hoặc bảng có Title|Due Date.")
    process.exit(0)
  }

  console.log(`🔎 Phát hiện ${tasks.length} task:`)
  tasks.forEach((t, i) => console.log(`  ${i + 1}. ${t.title} ${t.due ? `(due: ${t.due})` : ""}`))

  let titlePropName = explicitTitleProp
  let datePropName = explicitDateProp
  if (!dryRun) {
    if (!process.env.NOTION_TOKEN) {
      console.error("❌ Thiếu NOTION_TOKEN trong môi trường (.env)")
      process.exit(1)
    }
    const detected = await detectDatabaseProps(
      databaseId,
      explicitTitleProp,
      explicitDateProp
    )
    titlePropName = detected.titlePropName
    datePropName = detected.datePropName
  } else {
    // In dry-run, accept provided props or fallback to common names
    titlePropName = titlePropName || "Name"
    datePropName = datePropName || "Due Date"
  }

  console.log(`\n🧭 Title property: ${titlePropName}`)
  console.log(`🗓️ Date property: ${datePropName || "<none> (sẽ bỏ qua due date)"}`)
  if (statusPropName) {
    if (statusValue) {
      console.log(`🏷️ Status: ${statusPropName} = ${statusValue}`)
    } else if (statusByDay) {
      console.log(`🏷️ Status theo ngày: ${JSON.stringify(statusByDay)}`)
    } else {
      console.log(`🏷️ Status động theo hạn: Today → In Progress; Future → Not Started; Past → Done`)
    }
  }

  if (dryRun) {
    console.log("\n✅ Dry-run: Không tạo page. Thoát.")
    return
  }

  console.log("\n🚀 Bắt đầu tạo tasks trong Notion...")
  for (const t of tasks) {
    try {
      let statusForTask = statusValue || null
      if (!statusForTask && statusPropName) {
        if (statusByDay) {
          const dayKey = normalizeVietnameseDayName(t.dayName || getVietnameseDayNameFromIsoDate(t.due))
          statusForTask = statusByDay[dayKey] || null
        }
        if (!statusForTask && t.due) {
          // Dynamic by due date
          const todayIso = new Date()
          const yyyy = todayIso.getUTCFullYear()
          const mm = String(todayIso.getUTCMonth() + 1).padStart(2, '0')
          const dd = String(todayIso.getUTCDate()).padStart(2, '0')
          const today = `${yyyy}-${mm}-${dd}`
          if (t.due === today) statusForTask = 'In Progress'
          else if (t.due > today) statusForTask = 'Not Started'
          else statusForTask = 'Done'
        }
      }
      await createTask(databaseId, titlePropName, datePropName, t, statusPropName, statusForTask)
      console.log(`  ✅ Đã tạo: ${t.title}${t.due ? ` (due ${t.due})` : ""}`)
    } catch (err) {
      console.error(`  ❌ Lỗi tạo task '${t.title}':`, err.body?.message || err.message)
    }
  }
  console.log("\n🎉 Hoàn tất!")
}

if (require.main === module) {
  main().catch(err => {
    console.error("❌ Lỗi không mong đợi:", err)
    process.exit(1)
  })
}


