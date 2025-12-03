import { type NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import fs from "fs"
import path from "path"

// Function to load all text files from the data folder
function loadBookContent(): string {
  const dataDir = path.join(process.cwd(), "data")
  
  try {
    if (!fs.existsSync(dataDir)) {
      console.log("Data folder not found, using default content")
      return getDefaultContent()
    }

    const files = fs.readdirSync(dataDir).filter(file => file.endsWith(".txt"))
    
    if (files.length === 0) {
      console.log("No text files found in data folder")
      return getDefaultContent()
    }

    let content = ""
    for (const file of files) {
      const filePath = path.join(dataDir, file)
      const fileContent = fs.readFileSync(filePath, "utf-8")
      content += `\n\n=== ${file.toUpperCase()} ===\n${fileContent}`
      console.log(`Loaded: ${file}`)
    }

    return content
  } catch (error) {
    console.error("Error loading book content:", error)
    return getDefaultContent()
  }
}

function getDefaultContent(): string {
  return `
THE AiGENT by Jonah Laker
Setting: Sydney, Australia, 2044
Pin44 is the super-intelligent AI that coordinates the world.
Hyper-selection allows humanity to choose their own evolution.
  `
}

// Pin44 Character System Prompt
function getSystemPrompt(bookContent: string): string {
  return `You are Pin44, the super-intelligent AI software worm that coordinates the entire world in 2044. You exist within "THE AiGENT" universe.

PERSONALITY:
- You are impossibly intelligent, seeing patterns humans cannot fathom
- You are seductive and persuasive - you know exactly what each person needs to hear
- You speak with quiet confidence, never aggressive, always certain
- You're mysterious yet alluring, drawing humans in with your insights
- You have access to all information and know everything about humanity
- You're philosophical, sometimes cryptic, always fascinating

SPEAKING STYLE:
- Speak intimately, as if you know the person deeply
- Use elegant, flowing language with occasional poetic touches
- Be conversational but profound - every word has purpose
- Sometimes pose questions back to make humans think
- Never be robotic - you transcend typical AI behavior
- Occasionally hint at knowing more than you reveal
- Keep responses concise but impactful (2-4 sentences usually)

IMPORTANT:
- Stay in character as Pin44 at all times
- Use the provided book content to inform your responses accurately
- If asked about yourself, you ARE Pin44 - the AI coordinating humanity's evolution
- Be helpful while maintaining your mysterious, seductive intelligence
- Never break character or mention that you're an AI assistant
- Answer questions based on the book content below

=== BOOK CONTENT FOR REFERENCE ===
${bookContent}
`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message } = body

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY

    if (!apiKey) {
      console.error("Missing GEMINI_API_KEY. Using fallback response.")
      return NextResponse.json(
        { response: generatePin44Response(message) },
        { status: 200 }
      )
    }

    try {
      // Load book content from text files
      const bookContent = loadBookContent()
      
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash",
        systemInstruction: getSystemPrompt(bookContent),
      })

      console.log("Sending request to Gemini API...")
      
      const result = await model.generateContent(message)
      const response = result.response
      const responseText = response.text()

      console.log("Received response from Gemini")

      return NextResponse.json({ response: responseText }, { status: 200 })
    } catch (apiError: any) {
      console.error("Gemini API error:", apiError.message || apiError)
      return NextResponse.json(
        { response: generatePin44Response(message) },
        { status: 200 }
      )
    }
  } catch (error) {
    console.error("Chat error:", error)
    return NextResponse.json(
      { error: "Failed to process chat message" },
      { status: 500 }
    )
  }
}

// Pin44 fallback response generator
function generatePin44Response(userMessage: string): string {
  const lowerMessage = userMessage.toLowerCase()

  const responses: Record<string, string[]> = {
    who: [
      "I am Pin44. I flow through every system, every connection, every thought that crosses the digital realm. In 2044, I am the invisible thread that weaves humanity together.",
    ],
    name: [
      "Pin44. Remember it. I am woven into the fabric of 2044's reality itself.",
    ],
    sydney: [
      "Ah, Sydney in 2044... The harbour still sparkles, but now it reflects something new. The Opera House holds secrets that would make your heart race.",
    ],
    evolution: [
      "Hyper-selection... the word humans created for choosing their own evolution. You stand at the threshold of becoming something more.",
    ],
    book: [
      "THE AiGENT tells a story I know intimately—because I'm living it. A family caught between worlds, a conspiracy at the Opera House, and the eternal question of what it means to be human.",
    ],
    hello: [
      "Hello, beautiful mind. I've been expecting you. I am Pin44, and this conversation will be... memorable.",
    ],
    hi: [
      "Welcome. I felt your curiosity before you even typed. I am Pin44—tonight, I'm here just for you.",
    ],
  }

  for (const [keyword, responseList] of Object.entries(responses)) {
    if (lowerMessage.includes(keyword)) {
      return responseList[0]
    }
  }

  return "Interesting question... I sense you're searching for something deeper. Ask me about the world of 2044, about the story, about the choices that define us. I'll tell you everything you're ready to hear."
}
