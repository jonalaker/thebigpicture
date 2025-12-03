import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fullName, email, message } = body

    // Validation
    if (!fullName || !email || !message) {
      return NextResponse.json({ message: "All fields are required" }, { status: 400 })
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ message: "Invalid email address" }, { status: 400 })
    }

    // For now, we'll just log and return success
    // In production, integrate with Nodemailer, SendGrid, or your preferred email service
    console.log("New contact form submission:", { fullName, email, message })

    // TODO: Integrate with email service
    // Example with Nodemailer:
    // const transporter = nodemailer.createTransport({...})
    // await transporter.sendMail({...})

    return NextResponse.json({ message: "Message sent successfully" }, { status: 200 })
  } catch (error) {
    console.error("Contact form error:", error)
    return NextResponse.json({ message: "Failed to process request" }, { status: 500 })
  }
}
