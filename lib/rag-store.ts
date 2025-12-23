import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";
import { Document } from "@langchain/core/documents";
import path from "path";
import fs from "fs";

// --- Custom Simple Vector Store Implementation ---
// avoiding 'langchain/vectorstores/memory' dependency issues
interface StoredVectorDoc {
    pageContent: string;
    metadata: Record<string, any>;
    embedding: number[];
}

class SimpleVectorStore {
    private documents: StoredVectorDoc[] = [];

    constructor(docs: StoredVectorDoc[]) {
        this.documents = docs;
    }

    static async fromDocuments(
        docs: Document[],
        embeddingsModel: GoogleGenerativeAIEmbeddings
    ): Promise<SimpleVectorStore> {
        const storedDocs: StoredVectorDoc[] = [];
        const texts = docs.map(d => d.pageContent);

        // Process in batches to avoid API limits
        const BATCH_SIZE = 10;
        console.log(`Computed embeddings for ${docs.length} chunks...`);

        for (let i = 0; i < texts.length; i += BATCH_SIZE) {
            const batchTexts = texts.slice(i, i + BATCH_SIZE);
            const batchEmbeddings = await embeddingsModel.embedDocuments(batchTexts);

            for (let j = 0; j < batchEmbeddings.length; j++) {
                storedDocs.push({
                    pageContent: docs[i + j].pageContent,
                    metadata: docs[i + j].metadata,
                    embedding: batchEmbeddings[j]
                });
            }
        }

        return new SimpleVectorStore(storedDocs);
    }

    async similaritySearchVectorWithScore(queryEmbedding: number[], k: number): Promise<[Document, number][]> {
        const results = this.documents.map(doc => {
            const score = this.cosineSimilarity(queryEmbedding, doc.embedding);
            return { doc, score };
        });

        // Sort by score descending (higher is more similar)
        results.sort((a, b) => b.score - a.score);

        return results.slice(0, k).map(r => [
            new Document({ pageContent: r.doc.pageContent, metadata: r.doc.metadata }),
            r.score
        ]);
    }

    save(filePath: string) {
        fs.writeFileSync(filePath, JSON.stringify(this.documents));
    }

    static load(filePath: string): SimpleVectorStore {
        const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        return new SimpleVectorStore(data);
    }

    private cosineSimilarity(a: number[], b: number[]): number {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}
// --------------------------------------------------

const DATA_DIR = path.join(process.cwd(), "data");
const VECTOR_STORE_PATH = path.join(process.cwd(), "data", "vector_store.json");

// Initialize embeddings model for DOCUMENT indexing
function getDocumentEmbeddings() {
    return new GoogleGenerativeAIEmbeddings({
        apiKey: process.env.GEMINI_API_KEY,
        modelName: "embedding-001",
        taskType: TaskType.RETRIEVAL_DOCUMENT,
    });
}

// Initialize embeddings model for QUERY (searching)
function getQueryEmbeddings() {
    return new GoogleGenerativeAIEmbeddings({
        apiKey: process.env.GEMINI_API_KEY,
        modelName: "embedding-001",
        taskType: TaskType.RETRIEVAL_QUERY,
    });
}

let vectorStoreInstance: SimpleVectorStore | null = null;

function smartSplitText(text: string, chunkSize: number = 800, chunkOverlap: number = 200): string[] {
    const chunks: string[] = [];
    const qaPattern = /Q\d+:/g;
    const qaMatches = [...text.matchAll(qaPattern)];

    if (qaMatches.length > 3) {
        console.log(`  📋 Detected Q&A format with ${qaMatches.length} questions`);
        for (let i = 0; i < qaMatches.length; i++) {
            const start = qaMatches[i].index!;
            const end = i < qaMatches.length - 1 ? qaMatches[i + 1].index! : text.length;
            const qaChunk = text.slice(start, end).trim();
            if (qaChunk.length > 0) chunks.push(qaChunk);
        }
    } else {
        const paragraphs = text.split(/\n\n+/);
        let currentChunk = "";

        for (const para of paragraphs) {
            const trimmed = para.trim();
            if (!trimmed) continue;

            if (currentChunk.length + trimmed.length < chunkSize) {
                currentChunk += (currentChunk ? "\n\n" : "") + trimmed;
            } else {
                if (currentChunk.length > 50) chunks.push(currentChunk);
                currentChunk = trimmed;
            }
        }
        if (currentChunk.length > 50) chunks.push(currentChunk);
    }
    return chunks;
}

function loadDocuments(): Document[] {
    console.log("📂 Loading documents from:", DATA_DIR);
    if (!fs.existsSync(DATA_DIR)) throw new Error(`Data directory not found at ${DATA_DIR}`);

    const files = fs.readdirSync(DATA_DIR);
    const docs: Document[] = [];

    for (const file of files) {
        const filePath = path.join(DATA_DIR, file);
        if (file.endsWith(".txt")) {
            const content = fs.readFileSync(filePath, "utf-8");
            console.log(`  📄 ${file}: ${content.length} chars`);
            // Split immediately
            const textChunks = smartSplitText(content);
            textChunks.forEach(chunk => {
                docs.push(new Document({
                    pageContent: chunk,
                    metadata: { source: file }
                }));
            });
        }
    }

    console.log(`  ✅ Loaded ${docs.length} total chunks`);
    return docs;
}

export async function getVectorStore(): Promise<SimpleVectorStore> {
    if (vectorStoreInstance) return vectorStoreInstance;

    // Try loading from disk first
    if (fs.existsSync(VECTOR_STORE_PATH)) {
        try {
            console.log("💿 Loading vector store from disk...");
            vectorStoreInstance = SimpleVectorStore.load(VECTOR_STORE_PATH);
            return vectorStoreInstance;
        } catch (e) {
            console.error("Korrupt vector store, recreating...");
        }
    }

    console.log("\n🔨 Creating new vector store...");
    const docs = loadDocuments();
    if (docs.length === 0) throw new Error("No documents found");

    const embeddings = getDocumentEmbeddings();
    vectorStoreInstance = await SimpleVectorStore.fromDocuments(docs, embeddings);

    // Save to disk
    vectorStoreInstance.save(VECTOR_STORE_PATH);
    console.log(`💾 Saved vector store to ${VECTOR_STORE_PATH}`);

    return vectorStoreInstance;
}

export async function searchDocuments(query: string, topK: number = 5): Promise<Document[]> {
    const store = await getVectorStore();
    console.log(`\n🔍 Searching for: "${query.substring(0, 30)}..."`);

    const queryEmbeddings = getQueryEmbeddings();
    const queryEmbedding = await queryEmbeddings.embedQuery(query);

    const results = await store.similaritySearchVectorWithScore(queryEmbedding, topK);

    console.log(`📚 Found ${results.length} relevant chunks:`);
    results.forEach(([doc, score], i) => {
        console.log(`  ${i + 1}. [${score.toFixed(3)}] ${doc.metadata.source}: "${doc.pageContent.substring(0, 50)}..."`);
    });

    return results.map(([doc]) => doc);
}

export async function refreshVectorStore(): Promise<void> {
    if (fs.existsSync(VECTOR_STORE_PATH)) fs.unlinkSync(VECTOR_STORE_PATH);
    vectorStoreInstance = null;
    await getVectorStore();
}

export function needsRebuild(): boolean {
    return !fs.existsSync(VECTOR_STORE_PATH) && vectorStoreInstance === null;
}
