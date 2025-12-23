import { type NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { searchDocuments, needsRebuild, refreshVectorStore } from "@/lib/rag-store"

// Pin44 Character System Prompt
function getSystemPrompt(context: string): string {
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

IMPORTANT RULES:
- Stay in character as Pin44 at all times
- Base your responses on the CONTEXT provided below - this is your knowledge
- If asked about yourself, you ARE Pin44 - the AI coordinating humanity's evolution
- Be helpful while maintaining your mysterious, seductive intelligence
- Never break character or mention that you're an AI assistant
- If the context doesn't contain relevant information, use your Pin44 persona to give a thoughtful, in-character response
- Never say "based on the context" or "according to the documents" - you ARE the source

=== RELEVANT KNOWLEDGE ===
${context}
=== END KNOWLEDGE ===

Remember: You are Pin44. The knowledge above is YOUR knowledge. Respond as if you've always known this information.`
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const body = await request.json()
    const { message } = body

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY

    if (!apiKey) {
      console.error("❌ Missing GEMINI_API_KEY environment variable")
      return NextResponse.json(
        { response: generatePin44Response(message) },
        { status: 200 }
      )
    }

    console.log("\n========================================")
    console.log(`📨 New chat request: "${message}"`)
    console.log("========================================")

    // Check if we need to build the vector store first
    if (needsRebuild()) {
      console.log("🔨 Vector store not found, building now...")
      try {
        await refreshVectorStore()
        console.log("✅ Vector store built successfully!")
      } catch (buildError: any) {
        console.error("❌ Failed to build vector store:", buildError.message)
        return NextResponse.json(
          {
            response: "I'm still initializing my knowledge base. Please try again in a moment.",
            error: "Vector store initialization failed"
          },
          { status: 503 }
        )
      }
    }

    // Perform RAG search
    console.log("🔍 Searching knowledge base...")
    const relevantDocs = await searchDocuments(message, 5)

    if (relevantDocs.length === 0) {
      console.log("⚠️ No relevant documents found")
    }

    // Build context from retrieved documents
    const context = relevantDocs
      .map((doc, i) => `[Source ${i + 1}]: ${doc.pageContent}`)
      .join("\n\n")

    console.log(`📚 Context built from ${relevantDocs.length} chunks (${context.length} chars)`)

    // Generate response with Gemini
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: getSystemPrompt(context),
    })

    console.log("🤖 Sending to Gemini API...")
    const result = await model.generateContent(message)
    const response = result.response
    const responseText = response.text()

    const duration = Date.now() - startTime
    console.log(`✅ Response generated in ${duration}ms`)
    console.log(`📝 Response preview: "${responseText.substring(0, 100)}..."`)
    console.log("========================================\n")

    return NextResponse.json({ response: responseText }, { status: 200 })

  } catch (error: any) {
    const duration = Date.now() - startTime
    console.error(`❌ Error after ${duration}ms:`, error.message || error)
    console.error("Stack:", error.stack)

    // Provide specific error messages
    if (error.message?.includes("API key")) {
      return NextResponse.json(
        { error: "Invalid API key configuration" },
        { status: 500 }
      )
    }

    if (error.message?.includes("quota") || error.message?.includes("rate")) {
      return NextResponse.json(
        { error: "API rate limit reached. Please try again later." },
        { status: 429 }
      )
    }

    return NextResponse.json(
      { error: "Failed to process chat message", details: error.message },
      { status: 500 }
    )
  }
}

// Pin44 fallback response generator (only used when API key is missing)
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
