import { NextResponse } from 'next/server'
import mysql from 'mysql2/promise'

// ---------- Shared connection helper ----------
async function connectDB() {
  return await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  })
}

// ---------- Utility: Normalize date to MySQL format ----------
function parseDateToMySQL(dateString) {
  if (!dateString) return new Date().toISOString().slice(0, 19).replace('T', ' ')
  try {
    // Clean up ordinal suffixes and non-date text
    const cleaned = dateString
      .replace(/(\d+)(st|nd|rd|th)/gi, '$1')
      .replace(/from IP.*$/i, '')
      .replace(/Updated|Created/gi, '')
      .trim()

    // Try parsing directly
    let date = new Date(cleaned)

    // If invalid, extract text pattern like "Oct 13 2025 14:19:42 PM"
    if (isNaN(date.getTime())) {
      const match = cleaned.match(
        /([A-Za-z]{3,9})\s+(\d{1,2}),?\s*(\d{4})?\s*(\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM)?)/i
      )
      if (match) {
        const normalized = `${match[1]} ${match[2]}, ${match[3] || new Date().getFullYear()} ${match[4]}`
        date = new Date(normalized)
      }
    }

    // Final fallback — current date
    if (isNaN(date.getTime())) date = new Date()

    // Convert to MySQL DATETIME format
    const iso = date.toISOString().slice(0, 19).replace('T', ' ')
    return iso
  } catch {
    return new Date().toISOString().slice(0, 19).replace('T', ' ')
  }
}

// ---------- CORS handler ----------
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

// ---------- POST: Insert or update ticket ----------
export async function POST(request) {
  let conn
  try {
    const data = await request.json()
    const safe = (val) => (val === undefined ? null : val)

    const createdAt = parseDateToMySQL(data.created_at)
    const updatedAt = parseDateToMySQL(data.updated_at)

    conn = await connectDB()

    const [existing] = await conn.execute(
      'SELECT id FROM tickets WHERE ticket_id = ? LIMIT 1',
      [safe(data.ticket_id)]
    )

    if (existing.length > 0) {
      await conn.execute(
        `UPDATE tickets
         SET subject = ?, brand = ?, status = ?, assigned_to = ?, client_name = ?, client_email = ?, created_at = ?, updated_at = ?, ticket_url = ?
         WHERE ticket_id = ?`,
        [
          safe(data.subject),
          safe(data.brand),
          safe(data.status),
          safe(data.assigned_to),
          safe(data.client_name),
          safe(data.client_email),
          createdAt,
          updatedAt,
          safe(data.ticket_url),
          safe(data.ticket_id),
        ]
      )
      console.log(`✅ Ticket updated: ${data.ticket_id}`)
    } else {
      await conn.execute(
        `INSERT INTO tickets (ticket_id, subject, brand, status, assigned_to, client_name, client_email, created_at, updated_at, ticket_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          safe(data.ticket_id),
          safe(data.subject),
          safe(data.brand || 'Unknown'),
          safe(data.status || 'Unknown'),
          safe(data.assigned_to),
          safe(data.client_name),
          safe(data.client_email),
          createdAt,
          updatedAt,
          safe(data.ticket_url),
        ]
      )
      console.log(`✅ New ticket saved: ${data.ticket_id}`)
    }

    // Insert messages (if any)
    if (data.messages?.length) {
      for (const msg of data.messages) {
        await conn.execute(
          `INSERT INTO ticket_messages (ticket_id, author, content, timestamp)
           VALUES (?, ?, ?, ?)`,
          [
            safe(data.ticket_id),
            safe(msg.author),
            safe(msg.content),
            parseDateToMySQL(msg.timestamp),
          ]
        )
      }
    }

    return NextResponse.json(
      { success: true, message: 'Ticket saved successfully' },
      { headers: { 'Access-Control-Allow-Origin': '*' } }
    )
  } catch (error) {
    console.error('POST Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    )
  } finally {
    if (conn) await conn.end()
  }
}

// ---------- GET: Retrieve all tickets ----------
export async function GET() {
  let conn
  try {
    conn = await connectDB()
    const [rows] = await conn.execute('SELECT * FROM tickets ORDER BY id DESC LIMIT 100')
    return NextResponse.json(rows, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  } catch (error) {
    console.error('GET Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    )
  } finally {
    if (conn) await conn.end()
  }
}

// ---------- DELETE: Remove ticket by ticket_id ----------
export async function DELETE(request) {
  let conn
  try {
    const { searchParams } = new URL(request.url)
    const ticketId = searchParams.get('id')

    if (!ticketId) {
      return NextResponse.json(
        { success: false, error: 'Missing ticket_id parameter' },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
      )
    }

    conn = await connectDB()
    const [result] = await conn.execute('DELETE FROM tickets WHERE ticket_id = ?', [ticketId])

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, message: 'No matching ticket found' },
        { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } }
      )
    }

    console.log(`🗑️ Deleted ticket: ${ticketId}`)
    return NextResponse.json(
      { success: true, message: `Ticket ${ticketId} deleted successfully` },
      { headers: { 'Access-Control-Allow-Origin': '*' } }
    )
  } catch (error) {
    console.error('DELETE Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    )
  } finally {
    if (conn) await conn.end()
  }
}
// ---------- DELETE: Remove ticket by ticket_id ----------